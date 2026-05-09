import { create } from 'zustand';
import { MascotEmotion } from '../assets';
import type { MascotKeywordEffect, MascotKeywordTrigger } from '../config/triggers';
import {
  resolveErrorMascotMessage,
  resolveIdleMascotMessage,
  resolveSearchKeywordTrigger,
  resolveSearchMascotMessage,
} from '../lib/messageResolver';

export interface ActiveMascotEasterEgg {
    id: string;
    effects: MascotKeywordEffect[];
    nonce: number;
}

interface MascotState {
    emotion: MascotEmotion;
    message: string;
    isVisible: boolean;
    isAnimating: boolean;
    lastTriggerAt: number;
    hasWelcomed: boolean;
    activeEasterEgg: ActiveMascotEasterEgg | null;
    easterEggCooldowns: Record<string, number>;

    // Actions
    say: (message: string, emotion?: MascotEmotion, duration?: number) => void;
    setEmotion: (emotion: MascotEmotion) => void;
    setVisible: (visible: boolean) => void;
    markWelcomed: () => void;
    reset: () => void;
    triggerKeywordEffects: (trigger: MascotKeywordTrigger) => void;
    clearEasterEgg: (nonce: number) => void;
    reactToSearch: (status: 'start' | 'empty' | 'found', query?: string) => void;
    reactToError: (type?: 'generic' | 'network' | 'notFound') => void;
}

const DEFAULT_STATE = {
    emotion: 'hi' as MascotEmotion,
    message: '今天也是充满希望的一天呢！',
    isVisible: false,
    isAnimating: false,
    lastTriggerAt: 0,
    hasWelcomed: false,
    activeEasterEgg: null,
    easterEggCooldowns: {},
};

export const useMascotStore = create<MascotState>((set, get) => ({
    ...DEFAULT_STATE,

    say: (message, emotion, duration = 4600) => {
        set({
            message,
            emotion: emotion || get().emotion,
            isVisible: true,
            isAnimating: true,
            lastTriggerAt: Date.now(),
        });
        setTimeout(() => set({ isAnimating: false }), 300);
        setTimeout(() => {
            const { lastTriggerAt } = get();
            if (Date.now() - lastTriggerAt >= duration - 120) {
                set({ isVisible: false });
            }
        }, duration);
    },

    setEmotion: (emotion) => set({ emotion }),

    setVisible: (visible) => set({ isVisible: visible }),

    markWelcomed: () => set({ hasWelcomed: true }),

    reset: () => {
        const resolved = resolveIdleMascotMessage();
        get().say(resolved.message, resolved.emotion);
    },

    triggerKeywordEffects: (trigger) => {
        if (!trigger.effects?.length) return;

        const now = Date.now();
        const effectId = trigger.keywords.join('|');
        const lastTriggeredAt = get().easterEggCooldowns[effectId] || 0;
        if (now - lastTriggeredAt < (trigger.cooldownMs ?? 0)) return;

        set((state) => ({
            activeEasterEgg: {
                id: effectId,
                effects: trigger.effects || [],
                nonce: now,
            },
            easterEggCooldowns: {
                ...state.easterEggCooldowns,
                [effectId]: now,
            },
        }));
    },

    clearEasterEgg: (nonce) => {
        if (get().activeEasterEgg?.nonce !== nonce) return;
        set({ activeEasterEgg: null });
    },

    reactToSearch: (status, query) => {
        const trigger = resolveSearchKeywordTrigger(query);
        if (trigger) {
            get().triggerKeywordEffects(trigger);
        }

        const resolved = resolveSearchMascotMessage(status, query);
        get().say(resolved.message, resolved.emotion);
    },

    reactToError: (type = 'generic') => {
        const resolved = resolveErrorMascotMessage(type);
        get().say(resolved.message, resolved.emotion);
    },
}));
