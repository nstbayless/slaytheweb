const MIN_CLI_WIDTH = 80
const MIN_MAIN_PANE_WIDTH = MIN_CLI_WIDTH - 25
const MAX_CARD_NAME_LENGTH = 18

const globals = {
    // must be able to support cli at least as large as this.
    MIN_CLI_WIDTH: MIN_CLI_WIDTH,
    MIN_CLI_HEIGHT: 24,
    MAX_MONSTERS: 5,

    MAX_HAND_SIZE: 10, // (TODO: this is a game state constant)
    MAX_CARD_NAME_LENGTH: MAX_CARD_NAME_LENGTH,
    CARD_SLOT_WIDTH: 5 + MAX_CARD_NAME_LENGTH,
    MAX_CREATURE_NAME_LENGTH: 18,

    // specific to encounter component
    MIN_MAIN_PANE_WIDTH: MIN_MAIN_PANE_WIDTH,
    MIN_INFO_PANE_WIDTH: MIN_CLI_WIDTH - MIN_MAIN_PANE_WIDTH - 1,
    MAX_CARD_ROWS: 5,
    MIN_PLAYER_ZONE_WIDTH: 20,
    MIN_ENEMY_ZONE_WIDTH: 30,
    TOOLBAR_HEIGHT: 3,

    colors: {
        energy: "#309042",
        energy_depleted: "#304032",
        hover: {
            'select-target': '#3000b0',
            default: "#706000"
        },
        hp: "#900000",
        block: "#0000d0"
    }
}
const g = globals
export {globals, g}