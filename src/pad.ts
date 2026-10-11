/** FXパッド上のポインタ座標(クライアント座標)を、パッド矩形でクランプした-1〜1のx,yに変換する(中心が0,0、左上が-1,-1、右下が1,1)。 */
export function normalizePadPosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((clientY - rect.top) / rect.height) * 2 - 1;
  return { x: Math.min(1, Math.max(-1, x)), y: Math.min(1, Math.max(-1, y)) };
}
