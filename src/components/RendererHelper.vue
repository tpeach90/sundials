<!-- Fix problem with blurry image on mobile devices, and enable local clipping -->

<script setup lang="ts" >
    import { useTresContext } from '@tresjs/core';
    const { renderer } = useTresContext();
    renderer.value.setPixelRatio(window.devicePixelRatio);
    renderer.value.localClippingEnabled = true;
</script>

