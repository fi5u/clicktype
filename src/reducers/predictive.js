import * as types from '../actions/action-types'
import deepAssign from 'deep-assign'

export const initialState = {
    words: {},
}

export default function predictive(state = initialState, action) {
    switch(action.type) {
    case types.ADD_PREDICTIVE_WORD: {
        const words = action.words.slice(-3)
        if(words.length === 0) {
            return state
        }

        const frequencies = [1, 1, 1]
        let wordsAtLevel = state.words
        // Set the frequencies
        if(words[0] in wordsAtLevel) {
            frequencies[0] = wordsAtLevel[words[0]].freq + 1
            wordsAtLevel = wordsAtLevel[words[0]].words

            if(words[1] && wordsAtLevel && words[1] in wordsAtLevel) {
                frequencies[1] = wordsAtLevel[words[1]].freq + 1
                wordsAtLevel = wordsAtLevel[words[1]].words

                if(words[2] && wordsAtLevel && words[2] in wordsAtLevel) {
                    frequencies[2] = wordsAtLevel[words[2]].freq + 1
                }
            }
        }

        const returnWords = {
            [words[0]]: {
                freq: frequencies[0],
            },
        }

        if(words[1]) {
            returnWords[words[0]].words = {
                [words[1]]: {
                    freq: frequencies[1]
                }
            }
        }

        if(words[2]) {
            returnWords[words[0]].words[words[1]].words = {
                [words[2]]: {
                    freq: frequencies[2]
                }
            }
        }

        return deepAssign({}, state, {words: returnWords})
    }

    default:
        return state
    }
}
