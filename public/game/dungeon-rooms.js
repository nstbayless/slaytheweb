import {isGodMode, uuid} from './utils.js'
import {shuffle, range} from './utils.js'

export function StartRoom() {
	return {
		id: uuid(),
		type: 'start',
	}
}

// A campfire gives our hero the opportunity to rest, remove or upgrade a card.
export function CampfireRoom() {
	return {
		id: uuid(),
		type: 'campfire',
		// choices: ['rest', 'remove', 'upgrade'],
	}
}

// A monster room has one or more monsters.
export function MonsterRoom(...monsters) {
	return {
		id: uuid(),
		type: 'monster',
		monsters,
	}
}

// A monster has health, probably some damage and a list of intents.
// Use a list of intents to describe what the monster should do each turn.
// Supported intents: block, damage, vulnerable and weak.
// Intents are cycled through as the monster plays its turn.
export function Monster(props = {}) {
	let intents = props.intents

	// By setting props.random to a number, all damage intents will be randomized with this range.
	if (typeof props.random === 'number') {
		intents = props.intents.map((intent) => {
			if (intent.damage) {
				let newDamage = shuffle(range(5, intent.damage - props.random))[0]
				intent.damage = newDamage
			}
			return intent
		})
	}

	if (isGodMode())
	{
		props.hp = 1
		props.currentHealth = 1
		props.block = 0
	}

	return {
		id: uuid(),
		currentHealth: props.currentHealth || props.hp || 42,
		maxHealth: props.hp || 42,
		block: props.block || 0,
		powers: props.powers || {},
		// A list of "actions" the monster will take each turn.
		// Example: [{damage: 6}, {block: 2}, {}, {weak: 2}]
		// ... meaning turn 1, deal 6 damage, turn 2 gain 2 block, turn 3 do nothing, turn 4 apply 2 weak
		intents: intents || [],
		// A counter to keep track of which intent to run next.
		nextIntent: 0,
		name: props.name
	}
}
