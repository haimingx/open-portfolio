// Prefer the async clipboard; when it is missing or denied, fall back to execCommand with the helper inside the dialog so the modal does not block the selection.
export async function copyText(text: string, host: HTMLElement = document.body): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  host.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}
