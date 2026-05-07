<script setup lang="ts">
import AppButton from "./AppButton.vue";
import AppIcon from "../Icons/AppIcon.vue";
</script>

<template>
  <Story title="Buttons/AppButton">
    <Variant title="Default">
      <AppButton>Stop</AppButton>
    </Variant>
    <Variant title="Action">
      <AppButton variant="action">Next</AppButton>
    </Variant>
    <Variant title="Surface">
      <AppButton variant="surface">Back</AppButton>
    </Variant>
    <Variant title="Disabled">
      <AppButton variant="action" disabled>Generating…</AppButton>
    </Variant>
    <Variant title="Icon left">
      <AppButton variant="action">
        <template #icon-left>
          <AppIcon name="play" :size="16" />
        </template>
        Play
      </AppButton>
    </Variant>
    <Variant title="Compact default">
      <AppButton compact>Stop</AppButton>
    </Variant>
    <Variant title="Compact action">
      <AppButton variant="action" compact>Next</AppButton>
    </Variant>
    <Variant title="Compact with icon">
      <AppButton variant="action" compact>
        <template #icon-left>
          <AppIcon name="play" :size="14" />
        </template>
        Play
      </AppButton>
    </Variant>
    <Variant title="Icon right">
      <AppButton variant="action">
        Continue
        <template #icon-right>
          <AppIcon name="arrow-right" :size="14" />
        </template>
      </AppButton>
    </Variant>
    <Variant title="Icon only (surface)">
      <AppButton variant="surface" icon>
        <AppIcon name="question" :size="16" />
      </AppButton>
    </Variant>
    <Variant title="Icon only (action)">
      <AppButton variant="action" icon>
        <AppIcon name="play" :size="16" />
      </AppButton>
    </Variant>
  </Story>
</template>
