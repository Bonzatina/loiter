import type { Localized } from '../lang'

/** One row of the about-page source list. */
export interface AboutSource {
  /** Bare host, exactly as shown to the reader. */
  domain: string
  /** Short, unqualified description of what the resource is. */
  ru: string
  en: string
}

/**
 * The city-specific part of the about page. Everything else on that page — the
 * LLM disclaimer, the personal-project paragraph, the visitor-notes paragraph,
 * the image-rights notice and the Ko-fi block — is shared prose in page-about.ts.
 */
export interface AboutData {
  /**
   * The topic enumeration spliced into the opening sentence, without the leading
   * colon and the trailing «и конкретные места…» / «and specific places…» clause:
   * «архитектура, история, музеи, парки, культура».
   */
  topics: Localized
  /**
   * Sources in display order, grouped thematically as they are ingested:
   * tourism portals → Wikipedia → official sites → museums → publications → blogs.
   */
  sources: AboutSource[]
}
