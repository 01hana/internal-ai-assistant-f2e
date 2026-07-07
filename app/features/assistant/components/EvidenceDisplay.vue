<script setup lang="ts">
import type { EvidenceReferenceDisplay } from '../../../types/assistant'

const props = defineProps<{
  evidence: EvidenceReferenceDisplay[]
}>()

const summaryEvidence = computed(() =>
  props.evidence.filter(
    (reference): reference is Extract<EvidenceReferenceDisplay, { kind: 'summary' }> =>
      reference.kind === 'summary',
  ),
)

const referenceOnlyEvidence = computed(() =>
  props.evidence.filter(
    (reference): reference is Extract<EvidenceReferenceDisplay, { kind: 'reference' }> =>
      reference.kind === 'reference',
  ),
)

</script>

<template>
  <div
    v-if="props.evidence.length > 0"
    class="grid gap-2"
    data-testid="assistant-evidence-display"
  >
    <div
      v-if="summaryEvidence.length > 0"
      class="grid gap-2"
    >
      <article
        v-for="reference in summaryEvidence"
        :key="reference.id"
        class="grid gap-1.5 rounded-xl border border-default/80 bg-elevated/60 px-3 py-2.5"
        data-testid="assistant-evidence-summary"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            color="primary"
            variant="soft"
            size="sm"
            data-testid="assistant-evidence-source-type"
          >
            {{ reference.sourceType }}
          </UBadge>
          <span class="text-[0.6875rem] text-muted">
            {{ reference.id }}
          </span>
        </div>

        <p
          v-if="reference.title"
          class="text-sm font-medium text-highlighted"
          data-testid="assistant-evidence-title"
        >
          {{ reference.title }}
        </p>

        <p
          v-if="reference.snippet"
          class="text-xs leading-relaxed text-toned"
          data-testid="assistant-evidence-snippet"
        >
          {{ reference.snippet }}
        </p>
      </article>
    </div>

    <div
      v-if="referenceOnlyEvidence.length > 0"
      class="flex flex-wrap gap-2"
      data-testid="assistant-evidence-reference-list"
    >
      <UBadge
        v-for="reference in referenceOnlyEvidence"
        :key="reference.id"
        color="neutral"
        variant="soft"
        size="sm"
        data-testid="assistant-evidence-reference"
      >
        {{ reference.id }}
      </UBadge>
    </div>
  </div>
</template>
