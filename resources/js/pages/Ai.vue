<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { nextTick, onMounted, ref } from 'vue';
import { Loader2, Send, Sparkles } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { ai } from '@/routes';
import { respond } from '@/routes/ai';

type ChatMessage = { id?: number; role: string; content: string };

const props = defineProps<{ messages?: ChatMessage[] }>();

const prompt = ref('');
const messages = ref<ChatMessage[]>([...(props.messages ?? [])]);
const processing = ref(false);
const error = ref('');
const scroller = ref<HTMLElement | null>(null);

function scrollToBottom() {
    nextTick(() => scroller.value?.scrollTo({ top: scroller.value.scrollHeight }));
}

onMounted(scrollToBottom);

function csrfToken(): string {
    return decodeURIComponent(
        document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '',
    );
}

async function submit() {
    if (!prompt.value.trim() || processing.value) return;

    const text = prompt.value;
    processing.value = true;
    error.value = '';
    messages.value.push({ role: 'user', content: text });
    prompt.value = '';
    scrollToBottom();

    try {
        const res = await fetch(respond().url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': csrfToken(),
            },
            body: JSON.stringify({ prompt: text }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);

        messages.value.push({ role: 'assistant', content: (await res.json()).response });
    } catch (e) {
        error.value =
            e instanceof Error ? e.message : 'Something went wrong';
    } finally {
        processing.value = false;
        scrollToBottom();
    }
}

defineOptions({
    layout: {
        breadcrumbs: [
            {
                title: 'AI',
                href: ai(),
            },
        ],
    },
});
</script>

<template>
    <Head title="AI" />

    <div class="flex h-[calc(100vh-4rem)] flex-col">
        <div class="flex items-center gap-3 border-b px-6 py-4">
            <div
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm"
            >
                <Sparkles class="h-5 w-5" />
            </div>

            <div>
                <h1 class="text-lg font-semibold leading-tight">
                    Ask AI
                </h1>

                <p class="text-sm text-muted-foreground">
                    Type a prompt and get an instant response.
                </p>
            </div>
        </div>

        <div ref="scroller" class="flex-1 overflow-y-auto px-6 py-6">
            <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <div
                    v-if="!messages.length && !processing"
                    class="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground"
                >
                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                        <Sparkles class="h-6 w-6" />
                    </div>
                    <p class="text-sm">Ask anything to get started.</p>
                </div>

                <div
                    v-for="(message, index) in messages"
                    :key="message.id ?? `new-${index}`"
                    class="flex"
                    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
                >
                    <div
                        class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed"
                        :class="message.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-card shadow-sm'"
                    >
                        {{ message.content }}
                    </div>
                </div>

                <div
                    v-if="processing"
                    class="flex items-center gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground"
                >
                    <Loader2 class="h-4 w-4 animate-spin" />
                    Thinking...
                </div>
            </div>
        </div>

        <div
            class="border-t bg-background/80 px-6 py-4 backdrop-blur"
        >
            <form
                class="mx-auto flex w-full max-w-3xl flex-col gap-2"
                @submit.prevent="submit"
            >
                <div
                    class="relative rounded-2xl border bg-card shadow-sm transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
                >
                    <textarea
                        v-model="prompt"
                        rows="3"
                        class="w-full resize-none rounded-2xl bg-transparent p-4 pr-28 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
                        placeholder="Ask something..."
                        :disabled="processing"
                        @keydown.enter.exact.prevent="submit"
                    />

                    <div class="absolute bottom-3 right-3">
                        <Button
                            type="submit"
                            size="sm"
                            :disabled="processing || !prompt.trim()"
                        >
                            <Loader2
                                v-if="processing"
                                class="mr-1.5 h-3.5 w-3.5 animate-spin"
                            />

                            <Send
                                v-else
                                class="mr-1.5 h-3.5 w-3.5"
                            />

                            {{ processing ? 'Thinking...' : 'Send' }}
                        </Button>
                    </div>
                </div>

                <p
                    v-if="error"
                    class="px-1 text-sm text-destructive"
                >
                    {{ error }}
                </p>

                <p
                    v-else
                    class="px-1 text-xs text-muted-foreground"
                >
                    Press
                    <kbd
                        class="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                    >
                        Enter
                    </kbd>
                    to send
                </p>
            </form>
        </div>
    </div>
</template>