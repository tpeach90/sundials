<script setup lang="ts">

    let boxHeight = 0;
    let sliderValue = 0;

    function sliderChange(e: Event) {
        const target = e.target as HTMLInputElement;
        sliderValue = parseInt(target.value)
    }

</script>

<template>

</template>


<script lang="ts">
    import { defineComponent } from 'vue'
    export default defineComponent({
        props: {

        },
        components: {
        }
    })
</script>

<style scoped>
    .sidebar {
        width: 300px;
        background: rgb(39, 39, 39);
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