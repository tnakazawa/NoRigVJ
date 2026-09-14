import type { PalettePreset } from "./palettes";

/** `HTMLSelectElement` のうちcontrol.tsが実際に使う部分(value/disabled/change)だけを模したインターフェース。 */
export interface PaletteDropdown {
  el: HTMLElement;
  value: string;
  disabled: boolean;
  addEventListener(type: "change", listener: () => void): void;
}

/** main/subの2色を表す小さな正方形2つ(縦に積んだ組)を作る。Customはグレーの枠線のみにする。 */
function createSwatchPair(preset: PalettePreset | null): HTMLElement {
  const pair = document.createElement("span");
  pair.className = "palette-swatch-pair";
  const mainSwatch = document.createElement("span");
  mainSwatch.className = "palette-swatch";
  const subSwatch = document.createElement("span");
  subSwatch.className = "palette-swatch";
  if (preset) {
    mainSwatch.style.backgroundColor = preset.palette.main;
    subSwatch.style.backgroundColor = preset.palette.sub;
  } else {
    mainSwatch.classList.add("palette-swatch-empty");
    subSwatch.classList.add("palette-swatch-empty");
  }
  pair.append(mainSwatch, subSwatch);
  return pair;
}

/**
 * カラーパレットのプリセット選択用ドロップダウン。
 *
 * ネイティブ `<select>` の `<option>` は多くのブラウザでOSネイティブのポップアップメニューとして
 * 描画され、`background`(グラデーション等)を設定しても実際の開閉時には反映されない(実機Chromeで
 * 確認済み。`size` 属性でインライン展開した場合は通常のDOM描画になり反映されるため、検証時に
 * 見誤りやすい)。そのため、プリセットを選ばずに配色を確認できるようにするには自作するしかない。
 * 文字にmain/subの色を直接重ねると配色によっては読みにくくなるため、テキストの左にmain/subの
 * 小さな色見本を2つ並べる(全面着色はしない)。
 * `value`/`disabled`/`addEventListener("change", ...)` だけ `HTMLSelectElement` と同じ形にして、
 * 呼び出し側(control.ts)の変更を最小限にしている。
 */
export function createPaletteDropdown(presets: PalettePreset[]): PaletteDropdown {
  const el = document.createElement("div");
  el.className = "palette-dropdown";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "palette-dropdown-trigger";
  const triggerSwatchSlot = document.createElement("span");
  const label = document.createElement("span");
  label.className = "palette-dropdown-label";
  trigger.append(triggerSwatchSlot, label);

  const list = document.createElement("div");
  list.className = "palette-dropdown-list";
  list.hidden = true;

  const changeListeners: (() => void)[] = [];
  let value = "0";

  function presetFor(v: string): PalettePreset | null {
    return v === "custom" ? null : presets[Number(v)];
  }

  function render() {
    const preset = presetFor(value);
    label.textContent = preset ? preset.name : "Custom";
    triggerSwatchSlot.innerHTML = "";
    triggerSwatchSlot.appendChild(createSwatchPair(preset));
    [...list.children].forEach((child) => {
      const optionEl = child as HTMLElement;
      optionEl.classList.toggle("selected", optionEl.dataset.value === value);
    });
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!el.contains(e.target as Node)) close();
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  function open() {
    if (trigger.disabled) return;
    list.hidden = false;
    // リストが開いている間だけdocumentにリスナーを張り、閉じたら外す(投影窓を閉じてもリークしないように)
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleKeydown);
  }
  function close() {
    list.hidden = true;
    document.removeEventListener("click", handleOutsideClick);
    document.removeEventListener("keydown", handleKeydown);
  }

  function addOption(v: string, name: string) {
    const optionEl = document.createElement("div");
    optionEl.className = "palette-dropdown-option";
    optionEl.dataset.value = v;
    optionEl.setAttribute("role", "option");
    optionEl.append(createSwatchPair(presetFor(v)));
    const labelEl = document.createElement("span");
    labelEl.textContent = name;
    optionEl.append(labelEl);
    optionEl.addEventListener("click", () => {
      value = v;
      render();
      close();
      changeListeners.forEach((listener) => listener());
    });
    list.appendChild(optionEl);
  }

  presets.forEach((preset, i) => addOption(String(i), preset.name));
  addOption("custom", "Custom");

  trigger.addEventListener("click", () => {
    if (list.hidden) open();
    else close();
  });

  el.append(trigger, list);
  render();

  return {
    el,
    get value() {
      return value;
    },
    set value(v: string) {
      value = v;
      render();
    },
    get disabled() {
      return trigger.disabled;
    },
    set disabled(v: boolean) {
      trigger.disabled = v;
      if (v) close();
    },
    addEventListener(type: "change", listener: () => void) {
      if (type === "change") changeListeners.push(listener);
    },
  };
}
