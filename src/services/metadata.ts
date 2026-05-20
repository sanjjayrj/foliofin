export interface WebBookMetadata {
  description?: string;
  subjects?: string[];
  publisher?: string;
  pageCount?: number;
  isbn?: string;
  rating?: number;
  ratingCount?: number;
  openLibraryCoverUrl?: string;
}

async function fromOpenLibrary(title: string, author?: string): Promise<WebBookMetadata | null> {
  const q = encodeURIComponent([title, author].filter(Boolean).join(' '));
  const fields = 'first_sentence,subject,publisher,number_of_pages_median,isbn,ratings_average,ratings_count,cover_i';
  const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=${fields}&limit=1`);
  if (!res.ok) return null;
  const json = await res.json();
  const doc = json.docs?.[0];
  if (!doc) return null;

  const sentence = doc.first_sentence;
  const description = typeof sentence === 'string'
    ? sentence
    : sentence?.value ?? undefined;

  return {
    description,
    subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 10) : undefined,
    publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : undefined,
    pageCount: doc.number_of_pages_median ?? undefined,
    isbn: Array.isArray(doc.isbn) ? doc.isbn[0] : undefined,
    rating: doc.ratings_average != null ? Math.round(doc.ratings_average * 10) / 10 : undefined,
    ratingCount: doc.ratings_count ?? undefined,
    openLibraryCoverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
  };
}

async function fromGoogleBooks(title: string, author?: string): Promise<WebBookMetadata | null> {
  const q = encodeURIComponent(
    `intitle:${title}${author ? `+inauthor:${author}` : ''}`
  );
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&printType=books`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const info = json.items?.[0]?.volumeInfo;
  if (!info) return null;

  return {
    description: info.description,
    subjects: info.categories,
    publisher: info.publisher,
    pageCount: info.pageCount,
    isbn: info.industryIdentifiers?.find(
      (i: { type: string; identifier: string }) => i.type === 'ISBN_13'
    )?.identifier,
    rating: info.averageRating,
    ratingCount: info.ratingsCount,
    openLibraryCoverUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:'),
  };
}

export async function fetchWebMetadata(
  title: string,
  author?: string
): Promise<WebBookMetadata | null> {
  try {
    const ol = await fromOpenLibrary(title, author);
    if (ol && (ol.description || ol.pageCount || ol.publisher)) return ol;
  } catch {}
  try {
    return await fromGoogleBooks(title, author);
  } catch {}
  return null;
}
