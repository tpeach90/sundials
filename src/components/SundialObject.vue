<script setup lang="ts">
    import { Text3D } from '@tresjs/cientos';
import { TresCanvas } from '@tresjs/core';
</script>


<template>
    <TresObject3D :position="[0,-1,0]">
        <!-- plate -->
        <TresMesh :position="[0,0.05,0]" receive-shadow>
            <TresBoxGeometry :args="[5,0.1, 5,]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

        <SundialLetter text="N" :position="[0, 0.1, -2]" cast-shadow />
        <SundialLetter text="E" :position="[2, 0.1, 0]" cast-shadow />
        <SundialLetter text="S" :position="[0, 0.1, 2]" cast-shadow />
        <SundialLetter text="W" :position="[-2, 0.1, 0]" cast-shadow />





        <!-- Style/gnomon -->
        <TresMesh :position="[0,1,0]" cast-shadow>
            <TresCylinderGeometry :args="[0.2, 0.2, 2]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>
    </TresObject3D>

</template>


<script lang="ts">
    import { defineComponent } from 'vue'
    import SundialLetter from './SundialLetter.vue';
    export default defineComponent({
        components: {
            SundialLetter
        }
    })
</script>