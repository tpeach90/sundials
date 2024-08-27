<!-- Fix problem with blurry image on mobile devices. -->

<script setup lang="ts" >
import { useTresContext } from '@tresjs/core';
const { renderer } = useTresContext();
renderer.value.setPixelRatio(window.devicePixelRatio);
</script>

<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({                                    
    name: "RendererHelper",
    components: {}
}) 
</script>