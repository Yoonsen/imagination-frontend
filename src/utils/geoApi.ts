export type GeoKeyType = 'geonames' | 'internal';

export interface GeoConcordanceRequest {
  keyType: GeoKeyType;
  key: string | number;
  filterIds?: number[];
  totalLimit?: number;
  before?: number;
  after?: number;
  renderHits?: boolean;
}

export interface GeoSequenceRequest {
  bookId: number;
  namespace?: string; // default: "geo"
  limit?: number;
}

export interface GeoConcordanceRow {
  bookId: number;
  seqStart: number;
  pos?: number;
  tokenLen?: number;
  placeKeyType?: GeoKeyType;
  placeKey?: string;
  placeId?: number | null;
  geonamesId?: number | null;
  surfaceText?: string | null;
  place?: {
    canonicalName?: string | null;
    geonamesId?: number | null;
    lat?: number | null;
    lon?: number | null;
    country?: string | null;
    variantText?: string | null;
  };
}

export interface GeoConcordanceResponse {
  namespace: string;
  resolver: string;
  rows: GeoConcordanceRow[];
  rendered?: Array<{ bookId: number; pos: number; frag: string }>;
  render_unresolved?: Array<{ bookId: number; pos: number }>;
  coverageMode?: string;
}

export interface GeoSequenceRow {
  bookId: number;
  seqStart: number;
  pos: number;
  tokenLen: number;
  placeKeyType: GeoKeyType;
  placeKey: string;
  placeId: number | null;
  geonamesId: number | null;
  variantId?: number | null;
  surfaceText?: string | null;
  place?: {
    canonicalName?: string | null;
    lat?: number | null;
    lon?: number | null;
    country?: string | null;
    variantText?: string | null;
  };
}

export interface GeoSequenceResponse {
  namespace: string;
  resolver: string;
  bookId: number;
  rows: GeoSequenceRow[];
  count: number;
}

export function createGeoApi(baseUrl = 'https://api.nb.no/dhlab/imag') {
  const base = baseUrl.replace(/\/+$/, '');

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
    }

    return (await res.json()) as T;
  }

  // Henter konkordanser for ett sted (ID + type).
  async function getGeoConcordanceByPlaceId(
    req: GeoConcordanceRequest
  ): Promise<GeoConcordanceResponse> {
    const {
      keyType,
      key,
      filterIds = [],
      totalLimit = 200,
      before = 8,
      after = 8,
      renderHits = true
    } = req;

    // Viktig: eksplisitt type, ikke bare #geo:<id>.
    const term = `#geo:${keyType}:${String(key)}`;

    return postJson<GeoConcordanceResponse>('/or_query', {
      terms: [term],
      useFilter: filterIds.length > 0,
      filterIds,
      totalLimit,
      before,
      after,
      renderHits
    });
  }

  // Henter rå sekvens av geo-treff for en bok (til rute/tidslinje).
  async function getGeoSequenceByBookId(
    req: GeoSequenceRequest
  ): Promise<GeoSequenceResponse> {
    const { bookId, namespace = 'geo', limit = 50000 } = req;

    return postJson<GeoSequenceResponse>('/api/geo/book/sequence', {
      bookId,
      namespace,
      limit
    });
  }

  return {
    getGeoConcordanceByPlaceId,
    getGeoSequenceByBookId
  };
}

