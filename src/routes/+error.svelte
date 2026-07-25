<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>{page.status} — {page.error?.message ?? "Error"}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div
  class="flex flex-col items-center justify-center min-h-[60vh] text-center px-8"
>
  <h1>{page.status}</h1>
  <p class="mt-4 text-lg opacity-70">
    {page.error?.message ?? "Something went wrong"}
  </p>
  <a href="/" class="mt-8 underline hover:no-underline">Go home</a>
</div>
