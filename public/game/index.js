import actions from './actions.js'
import ActionManager from './action-manager.js'

// This function returns a "game" object with everything you need to play and control the game.
// Note: it IS possible to modify all aspects of the game using actions directly.
// This is purely a nicer API.

// Here's an example:
// ```
// const game = createNewGame()
// game.enqueue({type: 'drawCards'})
// // game.future.length === 1
// game.dequeue()
// // game.future.length === 0
// // game.past.length === 1
// // game.state now includes the updated state.
// // You can also undo!
// game.undo()
// ```

export default function createNewGame() {
	const actionManager = ActionManager({debug: false})

	// Adds a dungeon, starter deck and draws cards.
	function createNewState() {
		let state = actions.createNewGame()
		state = actions.setDungeon(state)
		state = actions.addStarterDeck(state)
		state = actions.drawCards(state)
		return state
	}

	return {
		state: createNewState(),
		actions,
		signalees: [],
		// receive a callback after something has been enqueued
		listen_once(cb) {
			this.signalees.push(cb)
		},
		enqueue(a) {
			actionManager.enqueue(a)
			const signalees = this.signalees
			this.signalees = []
			setTimeout(() => {
				for (cb of signalees)
				{
					cb()
				}
			}, 0)
		},
		// return true if dequeue successful
		dequeue() {
			try {
				const nextState = actionManager.dequeue(this.state)
				if (nextState)
				{
					this.state = nextState
					return true
				}
			} catch (err) {
				console.warn(err)
			}
			return false
		},
		undo() {
			const prevGame = actionManager.undo()
			if (prevGame) this.state = prevGame.state
			return prevGame
		},
		future: actionManager.future,
		past: actionManager.past,
	}
}
