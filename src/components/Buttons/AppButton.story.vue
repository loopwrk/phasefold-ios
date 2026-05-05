<script setup lang="ts">
import AppButton from "./AppButton.vue";
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
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.54v14.92a1 1 0 0 0 1.5.87l12.5-7.46a1 1 0 0 0 0-1.74L2.5.67A1 1 0 0 0 1 1.54Z" fill="currentColor" />
          </svg>
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
          <svg width="14" height="16" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.54v14.92a1 1 0 0 0 1.5.87l12.5-7.46a1 1 0 0 0 0-1.74L2.5.67A1 1 0 0 0 1 1.54Z" fill="currentColor" />
          </svg>
        </template>
        Play
      </AppButton>
    </Variant>
    <Variant title="Icon right">
      <AppButton variant="action">
        Continue
        <template #icon-right>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 7h12m0 0L8 2m5 5L8 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </template>
      </AppButton>
    </Variant>
  </Story>
</template>
