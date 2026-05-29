/**
 * Shared browser file download utility.
 *
 * Creates a Blob from the provided data and triggers a browser download
 * via a temporary `<a>` element.
 */

/**
 * Trigger a browser download for arbitrary binary data.
 *
 * @param data     - ArrayBuffer, Uint8Array, or BlobPart data
 * @param filename - Suggested download filename
 * @param mimeType - MIME type of the data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function downloadBlob(data: any, filename: string, mimeType: string): void {
	const blob = new Blob([data], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
