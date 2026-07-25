<script lang="ts">
  let {
    trigger = false,
    style = "",
    transitionDuration = 2000,
    class: passedClasses = "",
    children,
  } = $props();
</script>

<div
  class="transition ease-fast-slow {passedClasses} {!trigger
    ? 'opacity-100 translate-y-0 delay-1000'
    : 'opacity-0 -translate-y-[50%]'}"
  style="transition-duration:{transitionDuration}ms; {style}"
>
  {@render children?.()}
</div>
