<script setup lang="ts">
    import { TresCanvas } from '@tresjs/core';
    import { OrbitControls } from '@tresjs/cientos'
    
    let sliderValue = ref<number>(1);

    function sliderChange(e: Event) {
        const target = e.target as HTMLInputElement;
        sliderValue.value = parseFloat(target.value)
    }


</script>

<template>
    <TresCanvas clear-color="#FFFF00" window-size>
        <TresPerspectiveCamera  />
        <TresMesh>
            <TresBoxGeometry :args="[sliderValue, 1, 1]" />
            <TresMeshNormalMaterial  />
        </TresMesh>
        <OrbitControls
            :enable-damping="false"
            :rotate-speed="0.5"
        />
    </TresCanvas>
    <div class="sidebar">
        <input 
            type="range" 
            min="0.01" 
            max="2"
            step="0.01" 
            value="1" 
            class="slider" 
            id="myRange"
            @input="sliderChange"
        >
        <p style="color: white">{{ sliderValue }}</p>
    </div>
</template>


<script lang="ts">
    import { defineComponent, ref } from 'vue'
    export default defineComponent({
        // props: {

        // },
        components: {
        }
    })
</script>

<style scoped>
    .sidebar {
        width: 300px;
        background: rgba(39, 39, 39, 0.95);
        opacity: 1;
        position: absolute;
        left: 0;
        top:0;
        height: 100%;
        padding: 20px;
    }

    .slider {
        width: 100%;
        opacity: 0.7; /* Fully shown on mouse-over */

    }

    .slider:hover {
        opacity: 1; /* Fully shown on mouse-over */
    }
</style>