/**
 * Run async tasks one at a time, in the order they were submitted.
 *
 * The ack loop needs this. A job line is written and awaits its `ok`; if `stop()` is called while
 * that line is in flight, its safety tail writes too, and both writers attach a listener for `ok`.
 * The arm answers one `ok` per line, and an EventEmitter delivers it to every listener, so the
 * second writer's promise resolved on the first writer's ack. The sender then ran ahead of the
 * machine, and a `wait` reply could be answered by rewriting a line that the other writer owned.
 *
 * Chaining the writes removes the class: one command is outstanding at a time, so each reply can
 * only belong to the command that is waiting for it.
 */

/**
 * A queue that accepts tasks and runs them in order. Each call returns a promise for that task's
 * own result. A task that rejects does not block the ones behind it, and its rejection is returned
 * to its own caller rather than to the queue.
 */
export const createSerialQueue = () => {
    let tail = Promise.resolve();

    return (task) => {
        // `then(task, task)` runs the task whether the previous one settled or failed, so one
        // failure cannot stall the queue.
        const run = tail.then(task, task);
        // The queue's own copy of the chain must not be a rejected promise, or nothing behind it
        // would run.
        tail = run.then(() => undefined, () => undefined);
        return run;
    };
};

export default createSerialQueue;
