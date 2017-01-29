import * as types from './action-types'

export function saveWords(words) {
    return {
        type: types.SAVE_WORDS,
        words,
    }
}

export function startTick() {
    return {
        type: types.START_TICK,
    }
}

export function stopTick() {
    return {
        type: types.STOP_TICK,
    }
}

export function tick() {
    return {
        type: types.TICK,
    }
}

export function select() {
    return {
        type: types.SELECT,
    }
}

export function updateOutput(text) {
    return {
        type: types.UPDATE_OUTPUT,
        text,
    }
}

export function setSuggestedWords(words) {
    return {
        type: types.SET_SUGGESTED_WORDS,
        words,
    }
}
