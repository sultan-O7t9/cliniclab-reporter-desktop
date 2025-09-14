declare module 'qrcode' {
  interface QRCodeToDataURLOptions {
    margin?: number
    width?: number
  }
  function toDataURL(text: string, opts?: QRCodeToDataURLOptions): Promise<string>
  export { toDataURL }
  const _default: { toDataURL: typeof toDataURL }
  export default _default
}
