class Power {
	constructor({type, target, use, name, color, sym}) {
		this.type = type
		this.target = target
		this.use = use
		this.name = name
		this.sym = sym
		this.color = color
	}
	// Each power usually does one thing. This method describes what. Needs to return a number.
	use() {
		return null
	}
}

// Heal an amount of healthpoints equal to regen stacks.
export const regen = new Power({
	type: 'buff',
	use: (stacks) => stacks,
	target: 'player',
	name: "Regeneration",
	sym: "⚕",
	color: "#ffffff",
})

// Vulnerable targets take 50% more damage.
export const vulnerable = new Power({
	type: 'debuff',
	use: (dmg) => Math.floor(dmg * 1.5),
	name: "Vulnerable",
	sym: "⌖",
	color: "#d00000",
})

// Weakened targets deal 25% less damage.
export const weak = new Power({
	type: 'debuff',
	use: (dmg) => Math.floor(dmg * 0.75),
	name: "Weakened",
	sym: "⚜",
	color: "#0040a0",
})

export default {regen, vulnerable, weak}
