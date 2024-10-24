<!-- Fix problem with blurry image on mobile devices, and enable local clipping -->

<script setup lang="ts" >
    import { useTresContext } from '@tresjs/core';
    // import { Camera } from 'three';
    const { renderer } = useTresContext();
    renderer.value.setPixelRatio(window.devicePixelRatio);
    renderer.value.localClippingEnabled = true;
// renderer.value.render(scene.value, camera.value as Camera)
// console.log(renderer.value.domElement.toDataURL())
</script>

