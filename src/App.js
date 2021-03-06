import './App.css'
import React, {
    Component,
} from 'react'
import {
    increaseSpeed,
    reduceSpeed,
} from './actions/settings'
import {
    puckActivated,
    puckActivating,
    puckActivationFailed,
} from './actions/puck'
import {
    select,
    setActiveColumn,
    toggleCapsLock,
    updateSuggestedWords,
} from './actions/grids'
import {
    setOutput,
    updateOutput,
} from './actions/output'
import {
    startTick,
    stopTick,
    tick,
} from './actions/timings'
import Grid from './components/Grid'
import Header from './components/Header'
import InfoBar from './components/InfoBar'
import LanguageProcessing from './services/language-processing'
import OutputDisplay from './components/OutputDisplay'
import PropTypes from 'prop-types'
import ReactGA from 'react-ga'
import _ from 'lodash'
import { addPredictiveWord } from './actions/predictive'
import { config } from './config'
import { connect } from 'react-redux'

export class App extends Component { // export from here to allow tests w/out redux
    constructor() {
        super()

        this.state = {
            showClearConfirm: false,
            windowWidth: this.getWindowWidth(window.innerWidth),
        }

        document.addEventListener('keydown', this.detectClick.bind(this), true)
        this.addLodashMixins()
        this.langProcess = new LanguageProcessing()
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints
        this.connection = null

        this.activatePuck = this.activatePuck.bind(this)
        this.clickButton = this.clickButton.bind(this)
        this.clickMainButton = this.clickMainButton.bind(this)

        document.addEventListener('touchstart', event => {
            if(event.target.tagName !== 'BUTTON') {
                this.clickMainButton()
            }
        })

        window.addEventListener('resize', () => {
            this.setState({
                windowWidth: this.getWindowWidth(window.innerWidth),
            })
        })
    }

    async componentDidUpdate(prevProps) {
        if(prevProps.output === this.props.output) { return }
        this.props.dispatch(updateSuggestedWords(await this.getSuggestedWords()))
    }

    activatePuck() {
        this.props.dispatch(puckActivating())

        if(this.connection) {
            this.connection.close()
            this.connection = null
        }

        window.Puck.connect(c => {
            if(!c) {
                this.props.dispatch(puckActivationFailed())
                return
            }
            this.connection = c

            // Watch for button presses
            this.connection.on('data', d => {
                if(d === 'btnpress') {
                    this.clickMainButton()
                }
            })

            // Watch for connection close
            this.connection.on('close', () => {
                this.props.dispatch(puckActivationFailed())
            })

            // Reset and set button watch on the Puck
            this.connection.write('reset();\n', () => {
                window.setTimeout(() => {
                    this.connection.write('setWatch(function() {Bluetooth.print("btnpress")}, BTN, {edge:"rising", debounce:50, repeat:true});\n',
                    () => {
                        this.props.dispatch(puckActivated())
                    })
                }, 1500)
            })
        })
    }

    addLodashMixins() {
        _.mixin({
            'sortKeysBy': (obj, comparator) => {
                var keys = _.sortBy(_.keys(obj), (key) => {
                    return comparator ? comparator(obj[key], key) : key
                })

                return _.zipObject(keys, _.map(keys, (key) => {
                    return obj[key]
                }))
            }
        })
    }

    clickButton({character, charType}, replace = false) {
        if(character === config.chars.clear) {
            if(this.state.showClearConfirm) {
                ReactGA.event({
                    action: 'Function',
                    category: 'Clear success',
                    label: this.props.output,
                })
                this.props.dispatch(setOutput(''))
                this.props.dispatch(toggleCapsLock(false))
                this.setState({
                    showClearConfirm: false,
                })
            }
            else {
                ReactGA.event({
                    action: 'Function',
                    category: 'Clear activated',
                    label: this.props.output,
                })
                this.setState({
                    showClearConfirm: true,
                })
            }
            return
        }
        else if(this.state.showClearConfirm) {
            this.setState({
                showClearConfirm: false,
            })
        }

        if(character === config.chars.capsLock) {
            this.props.dispatch(toggleCapsLock(!this.props.settings.capsLock))
            return
        }

        if(character === config.chars.speedUp || character === config.chars.speedDown) {
            if((character === config.chars.speedDown && this.props.settings.canDecreaseSpeed) ||
                (character === config.chars.speedUp && this.props.settings.canIncreaseSpeed)) {
                this.stopAndPause(2)
                this.props.dispatch(character === config.chars.speedDown ? reduceSpeed() : increaseSpeed())
            }

            return
        }

        const isSuggestedWord = charType === 'suggested'
        this.props.dispatch(replace ? setOutput(character) : updateOutput(character, isSuggestedWord, this.props.settings))

        // Move focus back to first suggested word
        if(isSuggestedWord) {
            this.stopAndPause(2)
            this.props.dispatch(setActiveColumn(this.props.grid[this.props.activeRow].length))
        }

        // Save predictive words
        const outputWords = this.props.output.trim().split(' ')
        if((character.slice(-config.chars.space.length) === config.chars.space || character.slice(-1) === ' ' || isSuggestedWord) && outputWords.length > 1) {
            this.props.dispatch(addPredictiveWord(outputWords.concat(outputWords[outputWords.length - 1] !== character ? character : [])))
        }

        ReactGA.event({
            action: 'Typing',
            category: charType,
            label: character,
        })
    }

    clickMainButton() {
        if(this.props.tickStarted || this.props.activeAxis === 'col') {
            if(this.props.activeAxis === 'col') {
                this.clickButton(this.props.grid[this.props.activeRow].concat(this.props.suggestedWords)[this.props.activeElement])
            }
            this.props.dispatch(select())

            // Stop and pause
            this.stopAndPause()
        }
        else {
            this.startTick()
        }
    }

    detectClick(event) {
        // If space or typing directly in textarea, then ignore
        if(event.keyCode !== 32) { return }
        this.clickMainButton()
        event.preventDefault()
    }

    getPredictiveWords(words) {
        let foundWords = []
        let wordsLower = words.map(word => (word.toLowerCase()))
        if(_.isEmpty(words)) {
            foundWords = this.getSortedObj(this.props.predictiveWords)
        }
        let testWord = wordsLower[wordsLower.length - 1]
        if(testWord && testWord in this.props.predictiveWords) {
            let results = this.getSortedObj(this.props.predictiveWords[testWord].words)
            foundWords = results.length ? results : foundWords
        }

        if(wordsLower[wordsLower.length - 2]
            && wordsLower[wordsLower.length - 2] in this.props.predictiveWords
            && 'words' in this.props.predictiveWords[wordsLower[wordsLower.length - 2]]
            && wordsLower[wordsLower.length - 1] in this.props.predictiveWords[wordsLower[wordsLower.length - 2]].words
        ) {
            let results = this.getSortedObj(this.props.predictiveWords[wordsLower[wordsLower.length - 2]].words[wordsLower[wordsLower.length - 1]].words)
            foundWords = results.length ? results : foundWords
        }
        return foundWords
    }

    getSortedObj(obj) {
        return _.reverse(Object.keys(_.sortKeysBy(obj, value => { return value.freq })))
    }

    async getSuggestedWords() {
        await this.getWordLists()
        let output = this.props.output.toLowerCase()
        let suggestedWords = config.gridParts.suggestedWords
        const outputWords = output.trim().split(' ')
        const lastWord = outputWords.length > 0 ? outputWords[outputWords.length - 1] : ''

        if(outputWords.length > 0) {
            // Do not allow duplicates
            // Concat the default suggested words
            suggestedWords = _.uniqBy(this.getPredictiveWords(outputWords).concat(config.gridParts.suggestedWords), word => word.toLowerCase()).slice(0, this.props.grid.suggestedWordCount)

            // If endeded on a full word and sentence is a question, offer question mark
            if(output.slice(-1) === ' ') {
                const lastSentence = output.split(/\.|\?|!/g).pop()
                if(this.langProcess.shouldBeAQuestion(lastSentence)) {
                    suggestedWords = ['?'].concat(suggestedWords).slice(0, this.props.grid.suggestedWordCount)

                    ReactGA.event({
                        action: 'Language',
                        category: 'Suggested question mark',
                        label: lastSentence,
                    })
                }
            }
        }
        if(output.trim().length > 0 && output.slice(-1) !== ' ') {
            // If last char is apostrope, suggest suitable replacements
            if(lastWord.slice(-1) === '’' || lastWord.slice(-1) === '\'') {
                return this.langProcess.getApostrophizedWords(lastWord)
            }

            const wordPart = output.trim().split(' ').pop()
            // Get common words
            suggestedWords = this.getWordsFromArray(this.commonWords, wordPart, this.props.grid.suggestedWordCount)
            // If not enough common words, get from full dictionary
            if(suggestedWords.length < this.props.grid.suggestedWordCount) {
                const suggestedFullWords = this.getWordsFromArray(this.words, wordPart, this.props.grid.suggestedWordCount - suggestedWords.length, suggestedWords)
                suggestedWords = suggestedWords.concat(suggestedFullWords)
            }

            // If no suggested words, suggest a space plus default suggested words
            if(!suggestedWords.length) {
                suggestedWords = config.gridParts.suggestedWords.map(word => ` ${word}`)
            }
        }

        // An 'i' in suggested words should be capitalized
        for(let i = suggestedWords.length - 1; i >= 0; i--) {
            if(suggestedWords[i] === 'i') {
                suggestedWords[i] = 'I'
            }
        }

        // If has typed 'a', first suggested word should be a space
        if(lastWord === 'a' && output.slice(-1) !== ' ') {
            suggestedWords = [config.chars.space].concat(suggestedWords).slice(0, this.props.grid.suggestedWordCount)
        }

        return suggestedWords
    }

    getWindowWidth(windowWidth) {
        if(windowWidth < 425) {
            return 'micro'
        }
        else if(windowWidth < 768) {
            return 'mini'
        }
        return 'full'
    }

    async getWordLists() {
        if(!this.commonWords || !this.words) {
            try {
                const {
                    commonWords,
                    words,
                } = await import('./data')

                this.commonWords = commonWords
                this.words = words
            }
            catch(e) {
                console.log('Failed to load words')
            }
        }
    }

    getWordsFromArray(wordArray, match, count, ignoreValues = []) {
        const stringAtStart = [] // store words that contain string at start
        const stringInString = [] // store words that contain string not at start
        for(let i = 0, len = wordArray.length; i < len; i++) {
            if(ignoreValues.indexOf(wordArray[i]) > -1) {
                continue
            }
            if(wordArray[i].indexOf(match.toLowerCase()) === 0) {
                stringAtStart.push(wordArray[i])
            }
            else if(wordArray[i].indexOf(match.toLowerCase()) > 0) {
                stringInString.push(wordArray[i])
            }
            if(stringAtStart.length >= count) {
                break
            }
        }
        return stringAtStart.concat(stringInString).slice(0, count)
    }

    startTick() {
        this.props.dispatch(startTick())
        this.ticker = window.setInterval(() => {
            this.props.dispatch(tick())
        }, this.props.settings.speed)
    }

    stopAndPause(times = 1) {
        if(this.pauseInProgress)  { return }
        this.pauseInProgress = true
        this.stopTick()
        window.setTimeout(() => {
            this.pauseInProgress = false
            if(this.props.tickStarted) { return }
            this.startTick()
        }, this.props.settings.speed * times)
    }

    stopTick() {
        clearInterval(this.ticker)
        this.props.dispatch(stopTick())
    }

    render() {
        const {
            activeAxis,
            activeElement,
            activeRow,
            grid,
            isRunning,
            settings,
            suggestedWords,
            output,
            puckActivated,
            puckActivating,
        } = this.props

        return (
            <div
                className="App"
            >
                <Header
                    activatePuck={this.activatePuck}
                    isRunning={isRunning}
                    isTouchDevice={!!this.isTouchDevice}
                    puckActivated={puckActivated}
                    puckActivating={puckActivating}
                />

                <Grid
                    activeAxis={activeAxis}
                    activeElement={activeElement}
                    activeRow={activeRow}
                    characterGrid={grid}
                    clickButton={this.clickButton}
                    output={output}
                    settings={settings}
                    showClearConfirm={this.state.showClearConfirm}
                    suggestedWords={suggestedWords}
                    windowWidth={this.state.windowWidth}
                />

                <OutputDisplay
                    value={output}
                />

                <InfoBar
                    settings={settings}
                />
            </div>
        )
    }
}

App.propTypes = {
    activeAxis: PropTypes.oneOf([
        'col',
        'row',
    ]).isRequired,
    activeElement: PropTypes.number.isRequired,
    activeRow: PropTypes.number.isRequired,
    dispatch: PropTypes.func.isRequired,
    grid: PropTypes.array.isRequired,
    isRunning: PropTypes.bool.isRequired,
    output: PropTypes.string.isRequired,
    predictiveWords: PropTypes.object.isRequired,
    puckActivated: PropTypes.bool.isRequired,
    puckActivating: PropTypes.bool.isRequired,
    settings: PropTypes.object.isRequired,
    suggestedWords: PropTypes.array.isRequired,
    tickStarted: PropTypes.bool.isRequired,
}

function mapStateToProps(state) {
    const {
        grids,
        output,
        predictive,
        puck,
        settings,
        timings,
    } = state

    return {
        activeAxis: grids.activeAxis,
        activeElement: grids.activeElement,
        activeRow: grids.activeRow,
        grid: grids.activeGrid,
        isRunning: timings.isRunning,
        output: output.output,
        predictiveWords: predictive.words,
        puckActivated: puck.activated,
        puckActivating: puck.activating,
        settings,
        suggestedWords: grids.suggestedWords,
        tickStarted: timings.tickStarted,
    }
}

export default connect(mapStateToProps)(App)
