import { runtime } from './artifactRemote';

interface DownloadsNs {
  save(req: { filename: string; data: string | Blob }): Promise<unknown>;
}

/** Saves a file: through the artifact's downloads capability when hosted on claude.ai, else a plain browser download. */
export async function saveFile(filename: string, data: string, type = 'application/json'): Promise<'saved' | 'declined'> {
  const claude = runtime();
  const dl = claude?.use ? ((await claude.use('downloads')) as DownloadsNs | null) : null;
  if (dl) {
    try {
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) {
      if ((e as { code?: string }).code === 'declined') return 'declined';
      // any other failure: fall through to a normal download
    }
  }
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}

export function pickFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.click();
  });
}
