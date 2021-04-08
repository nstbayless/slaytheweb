// All our cards.
export default [
	{
		name: 'Defend',
		type: 'Skill',
		energy: 1,
		block: 5,
		target: 'player',
		description: 'Gain 5 Block.',
		upgrade() {
			this.block = 8
			this.description = 'Gain 8 Block.'
		},
	},
	{
		name: 'Strike',
		type: 'Attack',
		energy: 1,
		target: 'enemy',
		damage: 6,
		description: 'Deal 6 Damage.',
		upgrade() {
			this.damage = 9
			this.description = 'Deal 9 Damage.'
		},
	},
	{
		name: 'Bash',
		type: 'Attack',
		energy: 2,
		damage: 8,
		target: 'enemy',
		powers: {
			vulnerable: 2,
		},
		description: 'Deal 8 damage. Apply 2 Vulnerable.',
		upgrade() {
			this.damage = 10
			this.powers.vulnerable = 3
			this.description = 'Deal 10 Damage. Apply 3 Vulnerable'
		},
	},
	{
		name: 'Clash',
		type: 'Attack',
		energy: 0,
		damage: 14,
		target: 'enemy',
		conditions: [
			{
				type: 'onlyType',
				cardType: 'Attack',
			},
		],
		description: 'Can only be played if every card in your hand is an Attack. Deal 14 damage.',
		upgrade() {
			this.damage = 17
			this.description =
				'Can only be played if every card in your hand is an Attack. Deal 17 damage.'
		},
	},
	{
		name: 'Cleave',
		type: 'Attack',
		energy: 1,
		damage: 8,
		target: 'all enemies',
		description: 'Deal 8 damage to all enemies.',
		upgrade() {
			this.damage = 11
			this.description = 'Deal 11 Damage to all enemies.'
		},
	},
	{
		name: 'Iron Wave',
		type: 'Attack',
		energy: 1,
		damage: 5,
		block: 5,
		target: 'enemy',
		description: 'Deal 5 damage. Gain 5 Block.',
		upgrade() {
			this.damage = 7
			this.block = 7
			this.description = 'Deal 7 Damage. Gain 7 Block.'
		},
	},
	{
		name: 'Sucker Punch',
		type: 'Attack',
		energy: 1,
		damage: 7,
		target: 'enemy',
		powers: {
			weak: 1,
		},
		description: 'Deal 7 Damage. Apply 1 Weak.',
		upgrade() {
			this.damage = 8
			this.powers.weak = 2
			this.description = 'Deal 8 Damage. Apply 2 Weak'
		},
	},
	{
		name: 'Thunderclap',
		type: 'Attack',
		energy: 1,
		damage: 4,
		target: 'all enemies',
		powers: {
			vulnerable: 1,
		},
		description: 'Deal 4 Damage. Apply 1 Vulnerable to all enemies.',
		upgrade() {
			this.damage = 6
			this.description = 'Deal 6 Damage. Apply 1 Vulnerable to all enemies.'
		},
	},
	{
		name: 'Flourish',
		type: 'Skill',
		energy: 2,
		target: 'player',
		description: 'Gain 5 Regen. Can only be played if your health is below 50%.',
		powers: {
			regen: 5,
		},
		conditions: [
			{
				type: 'healthPercentageBelow',
				percentage: 50,
			},
		],
		upgrade() {
			const a = this.conditions.find((action) => action.type === 'healthPercentageBelow')
			a.percentage = 75
			this.description = 'Gain 5 Regen. Can only be played if your health is below 75%'
		},
		/*
		// Not implemented. Playing around with syntax
		condition(state) {
			const percentage = state.player.currentHealth / state.player.maxHealth * 100
			return percentage < 50
		},*/
	},
	{
		name: 'Summer of Sam',
		type: 'Skill',
		energy: 1,
		target: 'player',
		description: 'Gain 1 Health. Draw 2 Cards if your health is below 50%.',
		actions: [
			{
				type: 'addHealth',
				parameter: {
					amount: 1,
				},
			},
			{
				type: 'drawCards',
				parameter: {
					amount: 2,
				},
				conditions: [
					{
						type: 'healthPercentageBelow',
						percentage: 50,
					},
				],
			},
		],
		upgrade() {
			const a = this.actions.find((action) => action.type === 'addHealth')
			a.parameter.amount = 2
			this.description = 'Gain 2 Health. Draw 2 Cards if your health is below 50%.'
		},
	},
	{
		name: 'Body Slam',
		energy: 1,
		type: 'Attack',
		target: 'enemy',
		description: 'Deal Damage equal to your Block',
		actions: [
			{
				type: 'dealDamageEqualToBlock',
			},
		],
		upgrade() {
			this.energy = 0
		},
	},
	// {name: 'Flex', energy: 0, type: 'Skill', description: 'Gain 2 Strength.'},
]
