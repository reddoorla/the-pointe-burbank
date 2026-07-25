/**
 * True when the Vimeo video exists and is embeddable (oEmbed responds 200).
 *
 * Intended for server-side load functions: validating the ID up front lets a
 * page fall back to its poster instead of rendering a dead player iframe.
 * The explicit User-Agent matters — Vimeo's oEmbed endpoint rejects requests
 * without one (Node's fetch sends none by default).
 */
export async function checkVimeoVideo(videoId: string): Promise<boolean> {
  if (!videoId) return false;

  try {
    const response = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
        `https://vimeo.com/${videoId}`,
      )}`,
      {
        headers: {
          "User-Agent": "SvelteKit App",
        },
      },
    );

    return response.ok;
  } catch (error) {
    console.error(`Failed to check Vimeo video ${videoId}:`, error);
    return false;
  }
}
