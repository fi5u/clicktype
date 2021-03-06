import * as types from './action-types'

export function select() {
    return {
        type: types.SELECT,
    }
}

export function setActiveColumn(columnIndex) {
    return {
        type: types.SET_ACTIVE_COLUMN,
        columnIndex,
    }
}

export function toggleCapsLock(value) {
    return {
        type: types.TOGGLE_CAPS_LOCK,
        value
    }
}

export function updateSuggestedWords(words) {
    return {
        type: types.UPDATE_SUGGESTED_WORDS,
        words,
    }
}
