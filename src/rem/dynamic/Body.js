/**
 * Base class for all body types. It takes
 * an object of parameters.
 * @author lo-th
 * @author schteppe
 * @author xprogram
 */
OIMO.Body = function(params){
	OIMO.EventEmitter.call(this);

	// Basic data
	this.name = "";
	this.world = null;
	this.material = params.material || new OIMO.Material;

	// Shape data
	this.shapes = [];
	this.shapeOffsets = [];
	this.shapeOrientations = [];

	// Position
	this.position = params.position || new OIMO.Vec3;
	this.prevPosition = new OIMO.Vec3;

	// Rotation
	this.rotation = params.rotation || new OIMO.Quat;
	this.prevRotation = new OIMO.Quat;

	// Velocity (both types)
	this.velocity = new OIMO.Vec3;
	this.angularVelocity = new OIMO.Vec3;

	// Vectors to compute in solver
	this.force = new OIMO.Vec3;
	this.impulse = new OIMO.Vec3;
	this.torque = new OIMO.Vec3;

	// Mass data
	this.mass = params.mass || 0;
	this.invMass = NaN;

	// Inertia data
	this.inertiaLocal = new OIMO.Mat3;
	this.inertiaWorld = new OIMO.Mat3;
	this.invInertiaLocal = new OIMO.Mat3;
	this.invInertiaWorld = new OIMO.Mat3;

	// Sleep data
	this.useSleep = true;
	this.sleeping = false;
	this.sleepDelay = 0.1;

	// Collision data
	this.produceForces = true;

	// Link data
	this.links = [];

	if(params.velocity)
		this.velocity.copy(params.velocity);

	if(params.angularVelocity)
		this.angularVelocity.copy(params.angularVelocity);

	if(params.shape)
		this.addShape(params.shape);
	else
		this.updateMassDetails();
};
OIMO.Body.prototype = {
	constructor: OIMO.Body,

	addShape: function(shape, offset, rotation){
		var a = _vec3_1;
		var b = _quat_1;

		// Transfer offset data if provided
		if(offset)
			a.copy(offset);

		// Transfer rotation data if provided
		if(rotation)
			b.copy(rotation);

		// Update shape before passing it to body
		shape.body = this;

		// Update body
		this.shapes.push(shape);
		this.shapeOffsets.push(a);
		this.shapeOrientations.push(b);
		this.updateMassDetails();

		return this;
	},
	removeShape: function(shape){
		var i = OIMO.arem(this.shapes, shape);
		OIMO.atake(this.shapeOffsets, i);
		OIMO.atake(this.shapeOrientations, i);
		this.updateMassDetails();

		return this;
	},
	awake: function(){
		this.sleeping = false;
		this.emit("awake");
	},
	sleep: function(){
		this.sleeping = true;
		this.velocity.setZero();
		this.angularVelocity.setZero();
		this.emit("sleep");
	},
	dispose: function(){
		this.world.removeBody(this);
		return this;
	},
	applyForce: function(f, p){
		if(this.type !== OIMO.BODY_DYNAMIC)
			return;

		this.force.add(f);
		this.torque.add(_vec3_1.crossVectors(p, f).clone());

		return this;
	},
	applyCentralForce: function(f){
		this.applyForce(f, _vec3_1.setZero());
		return this;
	},
	updateInertiaWorld: function(override){ // From cannon.js
		var ir = this.invInertiaLocal;

		// Only update when the diagonal entries are different
		if((ir.x !== ir.y && ir.y !== ir.z) || override){
			_mat3_1.setFromQuaternion(this.rotation).transpose(_mat3_2).scale(ir);
			this.invInertiaWorld.multiplyMatrices(_mat3_1, _mat3_2);
		}
	},
	integrate: function(dt){ // From cannon.js
		var pos = this.position, rot = this.rotation, lvel = this.velocity, avel = this.angularVelocity;
		var g = this.invMass * dt, f = this.force, t = this.torque;
		var lfac = this.linearFactor, afac = this.angularFactor, hdt = dt * 0.5;
		var ax = avel.x * afac.x, ay = avel.y * afac.y, az = avel.z * afac.z, bx = rot.x, by = rot.y, bz = rot.z, bw = rot.w;

		// Update velocity (linear)
		lvel.x += f.x * g * lfac;
		lvel.y += f.y * g * lfac;
		lvel.z += f.z * g * lfac;

		// Update velocity (angular)
		var e = this.invInertiaWorld.elements;
		var tx = torque.x * afac.x, ty = torque.y * afac.y, tz = torque.z * afac.z;
		avel.x += dt * (e[0] * tx + e[1] * ty + e[2] * tz);
		avel.y += dt * (e[3] * tx + e[4] * ty + e[5] * tz);
		avel.z += dt * (e[6] * tx + e[7] * ty + e[8] * tz);

		// Update position
		this.prevPosition.copy(pos);
		pos.x += lvel.x * dt;
		pos.y += lvel.y * dt;
		pos.z += lvel.z * dt;

		// Update rotation
		this.prevRotation.copy(rot);
		rot.x += hdt * (ax * bw + ay * bz - az * by);
		rot.y += hdt * (ay * bw + az * bx - ax * bz);
		rot.z += hdt * (az * bw + ax * by - ay * bx);
		rot.w += hdt * (-ax * bx - ay * by - az * bz);

		// Update extra information
		this.updateInertiaWorld();
		this.updateShapes();
	},
	updateShapes: function(){
		var i = this.shapes.length;

		while(i--)
			this.shapes[i].computeAabb();
	},
	updateMassDetails: function(){
		var ir = this.inertiaLocal;
		this.invMass = (this.mass > 0) ? 1 / this.mass : 0;
	}
};