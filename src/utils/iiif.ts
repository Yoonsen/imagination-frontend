export interface CatalogImage {
  title: string;
  date: string;
  thumbnail: string;
  manifest: string;
  viewUrl: string;
  source: string;
}

const NB_API_BASE = 'https://api.nb.no/catalog/v1/search';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toHighResThumbnail(links: Record<string, unknown> | null): string {
  if (!links) return '';
  const customTemplate = asString(asRecord(links.thumbnail_custom)?.href);
  if (customTemplate.includes('{width},{height}')) {
    // Ask resolver for a larger thumbnail so cards stay crisp.
    return customTemplate.replace('{width},{height}', '640,640');
  }
  return (
    asString(asRecord(links.thumbnail_large)?.href) ||
    asString(asRecord(links.thumbnail_medium)?.href) ||
    asString(asRecord(links.thumbnail_small)?.href)
  );
}

export async function fetchNbCatalogImages(searchTerm: string, limit = 6): Promise<CatalogImage[]> {
  const term = searchTerm.trim();
  if (!term) return [];

  const params = new URLSearchParams({
    q: term,
    mediaTypeOrder: 'bilder',
    mediaTypeSize: '1',
    filter: 'mediatype:bilder',
    searchType: 'FULL_TEXT_SEARCH',
    sort: 'date',
    sortOrder: 'asc',
    size: String(Math.max(1, limit)),
    profile: 'wwwnbno'
  });

  const response = await fetch(`${NB_API_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch catalog images');

  const data: unknown = await response.json();
  const root = asRecord(data);
  if (!root) return [];

  const embedded = asRecord(root._embedded);
  const mediaTypeResults = asArray(embedded?.mediaTypeResults);
  const firstMedia = asRecord(mediaTypeResults[0]);
  const result = asRecord(firstMedia?.result);
  const resultEmbedded = asRecord(result?._embedded);
  const items = asArray(resultEmbedded?.items);

  return items
    .map((item): CatalogImage | null => {
      const itemRec = asRecord(item);
      if (!itemRec) return null;

      const metadata = asRecord(itemRec.metadata);
      const links = asRecord(itemRec._links);
      const thumbnail = toHighResThumbnail(links);
      if (!thumbnail) return null;

      const manifest = asString(asRecord(links?.presentation)?.href);
      const identifiers = asRecord(metadata?.identifiers);
      const urn = asString(identifiers?.urn);

      return {
        title: asString(metadata?.title) || term,
        date: asString(metadata?.dateCreated),
        thumbnail,
        manifest,
        viewUrl: urn ? `https://www.nb.no/items/${urn}` : '#',
        source: 'NB.no'
      };
    })
    .filter((item): item is CatalogImage => item !== null);
}
