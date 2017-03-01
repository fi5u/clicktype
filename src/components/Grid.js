import './Grid.css'
import React, { PropTypes } from 'react'
import { Button } from 'react-bootstrap'
import GridRow from './GridRow'
import { shouldCapitalize } from '../helpers'

const Grid = ({
    activeElement,
    activeRow,
    characterGrid,
    clickButton,
    output,
    settings,
    suggestedWords,
}) => (
    <div
        className="Grid"
    >
        {characterGrid.map((row, iteration) => {
            return (
                <GridRow
                    clickButton={clickButton}
                    isActive={iteration === activeRow}
                    key={`row-${iteration}`}
                >
                    {row.concat(suggestedWords).map((character, charIteration) => {
                        return(
                            <Button
                                className={`GridItem${iteration === activeRow && charIteration === activeElement ? ' GridItem--is-active' : ''}`}
                                key={character}
                                onClick={() => clickButton(character)}
                                style={{
                                    textTransform: settings.autoCapitalize && shouldCapitalize(output) ? 'capitalize' : 'none',
                                }}
                            >
                                {character}
                            </Button>
                        )
                    })}
                </GridRow>
            )
        })}
    </div>
)

Grid.propTypes = {
    activeElement: PropTypes.number.isRequired,
    activeRow: PropTypes.number.isRequired,
    characterGrid: PropTypes.array.isRequired,
    clickButton: PropTypes.func.isRequired,
    output: PropTypes.string.isRequired,
    settings: PropTypes.object.isRequired,
    suggestedWords: PropTypes.array.isRequired,
}

export default Grid
