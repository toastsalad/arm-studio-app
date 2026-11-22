import {describe, expect, it} from 'vitest';
import {
    drawnForModel,
    drawnSegments,
    execOrdinalOfToolPathLine,
    executableLines,
    isExecutableLine,
    modelLineRanges,
} from '../src/utils/plotProgress.js';

// The sender drops blank and comment lines before it counts what it has sent, and the bridge counts a job
// by the same rule. Every assertion here exists because getting that wrong shifts the red by exactly the
// number of comments in the file, which is invisible on a small drawing and obvious on a real one.

describe('which lines count', () => {
    it('drops blanks and whole-line comments, keeps trailing ones', () => {
        expect(isExecutableLine('G1 X1')).toBe(true);
        expect(isExecutableLine('  G1 X1 Y2  ')).toBe(true);
        expect(isExecutableLine('G1 X1 ; a note')).toBe(true);
        expect(isExecutableLine('; a comment')).toBe(false);
        expect(isExecutableLine('   ; indented comment')).toBe(false);
        expect(isExecutableLine('')).toBe(false);
        expect(isExecutableLine('   ')).toBe(false);
    });

    it('counts a job the way the sender does', () => {
        const gcode = 'G90\n; prelude\n\nG1 X1\nG0 Z5\n; done\n';
        expect(executableLines(gcode)).toEqual(['G90', 'G1 X1', 'G0 Z5']);
    });
});

describe('toolpath line -> gcode line', () => {
    it('maps one for one, because the emitter writes one line per toolpath line', () => {
        // Three toolpath lines: a move, a comment-only line, a move. The emitter ends the text with a
        // newline, so there is one trailing entry the mapping never reaches.
        const gcode = 'G1 X1\n;note\nG1 X2\n';
        expect(execOrdinalOfToolPathLine(gcode)).toEqual([0, 1, 1, 2]);
    });

    it('gives a comment line the same ordinal as the line after it', () => {
        const ordinals = execOrdinalOfToolPathLine('G1 X1\n;note\nG1 X2\nM5\n');
        expect(ordinals[1]).toBe(ordinals[2]);
        expect(ordinals[3]).toBe(2);
    });
});

describe('how much is drawn', () => {
    // A toolpath with segments from lines 0..4 and no comments: one segment per line, in order.
    const lineOfSegment = Int32Array.from([0, 1, 2, 3, 4]);
    const execOrdinal = execOrdinalOfToolPathLine('G1\nG1\nG1\nG1\nG1\n');

    it('draws nothing before the first line', () => {
        expect(drawnSegments(lineOfSegment, execOrdinal, 0)).toBe(0);
        expect(drawnSegments(lineOfSegment, execOrdinal, -3)).toBe(0);
    });

    it('draws one segment per line sent', () => {
        expect(drawnSegments(lineOfSegment, execOrdinal, 1)).toBe(1);
        expect(drawnSegments(lineOfSegment, execOrdinal, 3)).toBe(3);
    });

    it('draws everything when the job is finished, and never more', () => {
        expect(drawnSegments(lineOfSegment, execOrdinal, 5)).toBe(5);
        expect(drawnSegments(lineOfSegment, execOrdinal, 500)).toBe(5);
    });

    it('keeps several segments of one line together', () => {
        // A single G-code line can leave two segments (the emitter splits M3 into a pen move plus the move).
        const many = Int32Array.from([0, 0, 1, 1, 1, 2]);
        expect(drawnSegments(many, execOrdinal, 1)).toBe(2);
        expect(drawnSegments(many, execOrdinal, 2)).toBe(5);
    });

    it('puts a comment-only line inside the segment that follows it', () => {
        const ordinals = execOrdinalOfToolPathLine('G1\n;note\nG1\n');
        const segments = Int32Array.from([0, 1, 2]);
        // One executable line sent: the comment line adds nothing, so only segment 0 is drawn.
        expect(drawnSegments(segments, ordinals, 1)).toBe(1);
    });

    it('survives a segment whose line is past the mapping', () => {
        expect(drawnSegments(Int32Array.from([0, 99]), execOrdinal, 2)).toBe(1);
    });
});

describe('a model inside a job', () => {
    const gcodePerModel = [
        'G90\nG1 X1\nG1 X2\n',      // 3 executable lines
        ';header\nG1 Y1\nG1 Y2\n',  // 2 executable lines, one comment
    ];

    it('gives each model its offset and length', () => {
        expect(modelLineRanges(gcodePerModel)).toEqual([
            {startLine: 0, lineCount: 3},
            {startLine: 3, lineCount: 2},
        ]);
    });

    it('reads a job-wide count as a per-model one', () => {
        const [first, second] = modelLineRanges(gcodePerModel);
        expect(drawnForModel(0, first)).toBe(0);
        expect(drawnForModel(2, first)).toBe(2);
        expect(drawnForModel(3, first)).toBe(3);
        // Inside the second model's range the first is complete and the second is partly so.
        expect(drawnForModel(4, first)).toBe(3);
        expect(drawnForModel(4, second)).toBe(1);
    });

    it('never asks a model for more lines than it has', () => {
        const [, second] = modelLineRanges(gcodePerModel);
        expect(drawnForModel(99, second)).toBe(2);
    });

    it('stays at zero for a model the job has not reached', () => {
        const [, second] = modelLineRanges(gcodePerModel);
        expect(drawnForModel(1, second)).toBe(0);
    });
});
