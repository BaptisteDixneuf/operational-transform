(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.OperationalTransform = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var TextOp = require("./TextOp");
exports.TextOp = TextOp;
var Document = require("./Document");
exports.Document = Document;
var TextOperation = require("./TextOperation");
exports.TextOperation = TextOperation;

},{"./Document":2,"./TextOp":3,"./TextOperation":4}],2:[function(require,module,exports){
var OT = require("./index");
var Document = (function () {
    function Document() {
        this.text = "";
        this.operations = [];
    }
    Document.prototype.apply = function (newOperation, revision) {
        // Should't happen
        if (revision > this.operations.length)
            throw new Error("The operation base revision is greater than the document revision");
        if (revision < this.operations.length) {
            // Conflict!
            var missedOperations = new OT.TextOperation(this.operations[revision].userId);
            missedOperations.targetLength = this.operations[revision].baseLength;
            for (var index = revision; index < this.operations.length; index++)
                missedOperations = missedOperations.compose(this.operations[index]);
            newOperation = missedOperations.transform(newOperation)[1];
        }
        this.text = newOperation.apply(this.text);
        this.operations.push(newOperation.clone());
        return newOperation;
    };
    return Document;
})();
module.exports = Document;

},{"./index":undefined}],3:[function(require,module,exports){
var TextOp = (function () {
    function TextOp(type, attributes) {
        this.type = type;
        this.attributes = attributes;
    }
    return TextOp;
})();
module.exports = TextOp;

},{}],4:[function(require,module,exports){
var OT = require("./index");
var TextOperation = (function () {
    function TextOperation(userId) {
        this.ops = [];
        // An operation's baseLength is the length of every string the operation
        // can be applied to.
        this.baseLength = 0;
        // The targetLength is the length of every string that results from applying
        // the operation on a valid input string.
        this.targetLength = 0;
        this.userId = userId;
    }
    TextOperation.prototype.serialize = function () {
        var ops = [];
        for (var _i = 0, _a = this.ops; _i < _a.length; _i++) {
            var op = _a[_i];
            ops.push({ type: op.type, attributes: op.attributes });
        }
        return { ops: ops, userId: this.userId };
    };
    TextOperation.prototype.deserialize = function (data) {
        if (data == null)
            return false;
        this.userId = data.userId;
        for (var _i = 0, _a = data.ops; _i < _a.length; _i++) {
            var op = _a[_i];
            switch (op.type) {
                case "retain":
                    this.retain(op.attributes.amount);
                    break;
                case "insert":
                    this.insert(op.attributes.text);
                    break;
                case "delete":
                    this.delete(op.attributes.text);
                    break;
                default: return false;
            }
        }
        return true;
    };
    TextOperation.prototype.retain = function (amount) {
        if (typeof (amount) !== "number" || amount <= 0)
            return;
        this.baseLength += amount;
        this.targetLength += amount;
        var prevOp = this.ops[this.ops.length - 1];
        if (prevOp != null && prevOp.type === "retain") {
            prevOp.attributes.amount += amount;
        }
        else {
            this.ops.push(new OT.TextOp("retain", { amount: amount }));
        }
    };
    TextOperation.prototype.insert = function (text) {
        if (typeof (text) !== "string" || text === "")
            return;
        this.targetLength += text.length;
        var prevOp = this.ops[this.ops.length - 1];
        if (prevOp != null && prevOp.type === "insert") {
            prevOp.attributes.text += text;
        }
        else {
            this.ops.push(new OT.TextOp("insert", { text: text }));
        }
    };
    TextOperation.prototype.delete = function (text) {
        if (typeof (text) !== "string" || text === "")
            return;
        this.baseLength += text.length;
        var prevOp = this.ops[this.ops.length - 1];
        if (prevOp != null && prevOp.type === "delete") {
            prevOp.attributes.text += text;
        }
        else {
            this.ops.push(new OT.TextOp("delete", { text: text }));
        }
    };
    TextOperation.prototype.apply = function (text) {
        if (text.length !== this.baseLength)
            throw new Error("The operation's base length must be equal to the string's length.");
        var index = 0;
        for (var _i = 0, _a = this.ops; _i < _a.length; _i++) {
            var op = _a[_i];
            switch (op.type) {
                case "retain":
                    index += op.attributes.amount;
                    break;
                case "insert":
                    text = text.substring(0, index) + op.attributes.text + text.substring(index, text.length);
                    index += op.attributes.text.length;
                    break;
                case "delete":
                    text = text.substring(0, index) + text.substring(index + op.attributes.text.length, text.length);
                    break;
            }
        }
        return text;
    };
    TextOperation.prototype.invert = function () {
        var invertedOperation = new TextOperation(this.userId);
        for (var _i = 0, _a = this.ops; _i < _a.length; _i++) {
            var op = _a[_i];
            switch (op.type) {
                case "retain":
                    invertedOperation.retain(op.attributes.amount);
                    break;
                case "insert":
                    invertedOperation.delete(op.attributes.text);
                    break;
                case "delete":
                    invertedOperation.insert(op.attributes.text);
                    break;
            }
        }
        return invertedOperation;
    };
    TextOperation.prototype.clone = function () {
        var operation = new TextOperation(this.userId);
        for (var _i = 0, _a = this.ops; _i < _a.length; _i++) {
            var op = _a[_i];
            switch (op.type) {
                case "retain":
                    operation.retain(op.attributes.amount);
                    break;
                case "insert":
                    operation.insert(op.attributes.text);
                    break;
                case "delete":
                    operation.delete(op.attributes.text);
                    break;
            }
        }
        return operation;
    };
    TextOperation.prototype.equal = function (otherOperation) {
        // if (otherOperation.insertedLength !== this.insertedLength) return false;
        if (otherOperation.ops.length !== this.ops.length)
            return false;
        for (var opIndex = 0; opIndex < this.ops.length; opIndex++) {
            var op = this.ops[opIndex];
            var otherOp = otherOperation.ops[opIndex];
            if (otherOp.type !== op.type)
                return false;
            for (var key in op.attributes) {
                var attribute = op.attributes[key];
                if (attribute !== otherOp.attributes[key])
                    return false;
            }
        }
        return true;
    };
    /*
    Largely inspired from Firepad
    Compose merges two consecutive operations into one operation, that
    preserves the changes of both. Or, in other words, for each input string S
    and a pair of consecutive operations A and B,
    apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.
    */
    TextOperation.prototype.compose = function (operation2) {
        if (this.targetLength !== operation2.baseLength)
            throw new Error("The base length of the second operation has to be the target length of the first operation");
        // the combined operation
        var composedOperation = new TextOperation(this.userId);
        var ops1 = this.clone().ops;
        var ops2 = operation2.clone().ops;
        var i1 = 0; // current index into ops1 respectively ops2
        var i2 = 0;
        var op1 = ops1[i1++]; // current ops
        var op2 = ops2[i2++];
        while (true) {
            // Dispatch on the type of op1 and op2
            // end condition: both ops1 and ops2 have been processed
            if (op1 == null && op2 == null)
                break;
            if (op2 == null) {
                switch (op1.type) {
                    case "retain":
                        composedOperation.retain(op1.attributes.amount);
                        break;
                    case "insert":
                        composedOperation.insert(op1.attributes.text);
                        break;
                    case "delete":
                        composedOperation.delete(op1.attributes.text);
                        break;
                }
                op1 = ops1[i1++];
                continue;
            }
            if (op1 == null) {
                switch (op2.type) {
                    case "retain":
                        composedOperation.retain(op2.attributes.amount);
                        break;
                    case "insert":
                        composedOperation.insert(op2.attributes.text);
                        break;
                    case "delete":
                        composedOperation.delete(op2.attributes.text);
                        break;
                }
                op2 = ops2[i2++];
                continue;
            }
            if (op1 != null && op1.type === "delete") {
                composedOperation.delete(op1.attributes.text);
                op1 = ops1[i1++];
                continue;
            }
            if (op2 != null && op2.type === "insert") {
                composedOperation.insert(op2.attributes.text);
                op2 = ops2[i2++];
                continue;
            }
            if (op1 == null)
                throw new Error("Cannot transform operations: first operation is too short.");
            if (op2 == null)
                throw new Error("Cannot transform operations: first operation is too long.");
            if (op1.type === "retain" && op2.type === "retain") {
                if (op1.attributes.amount === op2.attributes.amount) {
                    composedOperation.retain(op1.attributes.amount);
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.amount > op2.attributes.amount) {
                    composedOperation.retain(op2.attributes.amount);
                    op1.attributes.amount -= op2.attributes.amount;
                    op2 = ops2[i2++];
                }
                else {
                    composedOperation.retain(op1.attributes.amount);
                    op2.attributes.amount -= op1.attributes.amount;
                    op1 = ops1[i1++];
                }
            }
            else if (op1.type === "insert" && op2.type === "delete") {
                if (op1.attributes.text.length === op2.attributes.text) {
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.text.length > op2.attributes.text.length) {
                    op1.attributes.text = op1.attributes.text.slice(op2.attributes.text.length);
                    op2 = ops2[i2++];
                }
                else {
                    op2.attributes.text = op2.attributes.text.slice(op1.attributes.text.length);
                    op1 = ops1[i1++];
                }
            }
            else if (op1.type === "insert" && op2.type === "retain") {
                if (op1.attributes.text.length > op2.attributes.amount) {
                    composedOperation.insert(op1.attributes.text.slice(0, op2.attributes.amount));
                    op1.attributes.text = op1.attributes.text.slice(op2.attributes.amount);
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.text.length === op2.attributes.amount) {
                    composedOperation.insert(op1.attributes.text);
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else {
                    composedOperation.insert(op1.attributes.text);
                    op2.attributes.amount -= op1.attributes.text.length;
                    op1 = ops1[i1++];
                }
            }
            else if (op1.type === "retain" && op2.type === "delete") {
                if (op1.attributes.amount === op2.attributes.text.length) {
                    composedOperation.delete(op2.attributes.text);
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.amount > op2.attributes.text.length) {
                    composedOperation.delete(op2.attributes.text);
                    op1.attributes.amount -= op2.attributes.text.length;
                    op2 = ops2[i2++];
                }
                else {
                    composedOperation.delete(op2.attributes.text.slice(0, op1.attributes.amount));
                    op2.attributes.text = op2.attributes.text.slice(op1.attributes.amount);
                    op1 = ops1[i1++];
                }
            }
            else {
                throw new Error("This shouldn't happen: op1: " + JSON.stringify(op1) + ", op2: " + JSON.stringify(op2));
            }
        }
        return composedOperation;
    };
    /*
    Largely inspired from Firepad
    Transform takes two operations A (this) and B (other) that happened concurrently and
    produces two operations A' and B' (in an array) such that
    `apply(apply(S, A), B') = apply(apply(S, B), A')`.
    This function is the heart of OT.
    */
    TextOperation.prototype.transform = function (operation2) {
        var operation1prime, operation2prime;
        var ops1, ops2;
        // Give priority with the user id
        if (this.gotPriority(operation2.userId)) {
            operation1prime = new TextOperation(this.userId);
            operation2prime = new TextOperation(operation2.userId);
            ops1 = this.clone().ops;
            ops2 = operation2.clone().ops;
        }
        else {
            operation1prime = new TextOperation(operation2.userId);
            operation2prime = new TextOperation(this.userId);
            ops1 = operation2.clone().ops;
            ops2 = this.clone().ops;
        }
        var i1 = 0;
        var i2 = 0;
        var op1 = ops1[i1++];
        var op2 = ops2[i2++];
        while (true) {
            // At every iteration of the loop, the imaginary cursor that both
            // operation1 and operation2 have that operates on the input string must
            // have the same position in the input string.
            // end condition: both ops1 and ops2 have been processed
            if (op1 == null && op2 == null)
                break;
            // next two cases: one or both ops are insert ops
            // => insert the string in the corresponding prime operation, skip it in
            // the other one. If both op1 and op2 are insert ops, prefer op1.
            if (op1 != null && op1.type === "insert") {
                operation1prime.insert(op1.attributes.text);
                operation2prime.retain(op1.attributes.text.length);
                op1 = ops1[i1++];
                continue;
            }
            if (op2 != null && op2.type === "insert") {
                operation1prime.retain(op2.attributes.text.length);
                operation2prime.insert(op2.attributes.text);
                op2 = ops2[i2++];
                continue;
            }
            if (op1 == null)
                throw new Error("Cannot transform operations: first operation is too short.");
            if (op2 == null)
                throw new Error("Cannot transform operations: first operation is too long.");
            if (op1.type === "retain" && op2.type === "retain") {
                // Simple case: retain/retain
                var minl = void 0;
                if (op1.attributes.amount === op2.attributes.amount) {
                    minl = op2.attributes.amount;
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.amount > op2.attributes.amount) {
                    minl = op2.attributes.amount;
                    op1.attributes.amount -= op2.attributes.amount;
                    op2 = ops2[i2++];
                }
                else {
                    minl = op1.attributes.amount;
                    op2.attributes.amount -= op1.attributes.amount;
                    op1 = ops1[i1++];
                }
                operation1prime.retain(minl);
                operation2prime.retain(minl);
            }
            else if (op1.type === "delete" && op2.type === "delete") {
                // Both operations delete the same string at the same position. We don't
                // need to produce any operations, we just skip over the delete ops and
                // handle the case that one operation deletes more than the other.
                if (op1.attributes.text.length === op2.attributes.text.length) {
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.text.length > op2.attributes.text.length) {
                    op1.attributes.text = op1.attributes.text.slice(op2.attributes.text.length);
                    op2 = ops2[i2++];
                }
                else {
                    op2.attributes.text = op1.attributes.text.slice(op1.attributes.text.length);
                    op1 = ops1[i1++];
                }
            }
            else if (op1.type === "delete" && op2.type === "retain") {
                var text = void 0;
                if (op1.attributes.text.length === op2.attributes.amount) {
                    text = op1.attributes.text;
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.text.length > op2.attributes.amount) {
                    text = op1.attributes.text.slice(0, op2.attributes.amount);
                    op1.attributes.text = op1.attributes.text.slice(op2.attributes.amount);
                    op2 = ops2[i2++];
                }
                else {
                    text = op1.attributes.text;
                    op2.attributes.amount -= op1.attributes.text.length;
                    op1 = ops1[i1++];
                }
                operation1prime.delete(text);
            }
            else if (op1.type === "retain" && op2.type === "delete") {
                var text = void 0;
                if (op1.attributes.amount === op2.attributes.text.length) {
                    text = op2.attributes.text;
                    op1 = ops1[i1++];
                    op2 = ops2[i2++];
                }
                else if (op1.attributes.amount > op2.attributes.text.length) {
                    text = op2.attributes.text;
                    op1.attributes.amount -= op2.attributes.text.length;
                    op2 = ops2[i2++];
                }
                else {
                    text = op2.attributes.text.slice(0, op1.attributes.amount);
                    op2.attributes.text = op2.attributes.text.slice(op1.attributes.amount);
                    op1 = ops1[i1++];
                }
                operation2prime.delete(text);
            }
            else {
                throw new Error("The two operations aren't compatible");
            }
        }
        if (this.gotPriority(operation2.userId))
            return [operation1prime, operation2prime];
        else
            return [operation2prime, operation1prime];
    };
    TextOperation.prototype.gotPriority = function (id2) { return (this.userId <= id2); };
    return TextOperation;
})();
module.exports = TextOperation;

},{"./index":undefined}]},{},[1])(1)
});