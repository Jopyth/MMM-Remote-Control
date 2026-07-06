import createDOMPurify from "dompurify";

// eslint-disable-next-line unicorn/prefer-global-this -- Browser-only module; DOMPurify needs the window object.
const purifier = createDOMPurify(window);

/**
 * Removes unsafe HTML from a parsed fragment using DOMPurify.
 * @param {string} html - HTML string to sanitize.
 * @returns {DocumentFragment} Sanitized fragment.
 */
export function sanitizeHtmlFragment (html) {

  return purifier.sanitize(String(html ?? ""), {"RETURN_DOM_FRAGMENT": true});

}

/**
 * Creates a safe changelog block from markdown HTML.
 * @param {string} titleText - Block title text.
 * @param {string} markdownHtml - Rendered markdown HTML.
 * @returns {HTMLDivElement} Wrapper element containing the changelog.
 */
export function createSanitizedMarkdownBlock (titleText, markdownHtml) {

  const wrapper = document.createElement("div"),
    title = document.createElement("h3"),
    changelog = document.createElement("div");
  title.textContent = titleText;
  changelog.id = "changelog";
  changelog.append(sanitizeHtmlFragment(markdownHtml));
  wrapper.append(
    title,
    changelog
  );

  return wrapper;

}
