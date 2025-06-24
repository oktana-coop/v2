import {
  codeBackticksRegexp,
  emAsteriskRegexp,
  emUnderscoreRegexp,
  strongAsteriskRegexp,
  strongUnderscoreRegexp,
} from './marks';

describe('Input Rules', () => {
  describe('Strong mark regex patterns', () => {
    describe('Asterisk', () => {
      it('matches text enclosed in asterisks', () => {
        const text = '**strong**';
        expect(strongAsteriskRegexp.test(text)).toBe(true);
      });

      it('matches text enclosed in asterisks along with included spaces', () => {
        const text = '** strong   **';
        expect(strongAsteriskRegexp.test(text)).toBe(true);
      });

      it('does not match text without asterisks', () => {
        const text = 'strong';
        expect(strongAsteriskRegexp.test(text)).toBe(false);
      });

      it('matches strong text which includes whitespace', () => {
        const text = '**strong text**';
        expect(strongAsteriskRegexp.test(text)).toBe(true);
      });

      it('does not match single asterisks', () => {
        const text = '*em*';
        expect(strongAsteriskRegexp.test(text)).toBe(false);
      });

      it('does not match invalid patterns', () => {
        const text1 = '**text*';
        const text2 = '**text';
        const text3 = '*text**';
        const text4 = 'text**';
        expect(strongAsteriskRegexp.test(text1)).toBe(false);
        expect(strongAsteriskRegexp.test(text2)).toBe(false);
        expect(strongAsteriskRegexp.test(text3)).toBe(false);
        expect(strongAsteriskRegexp.test(text4)).toBe(false);
      });

      it('matches only the first token enclosed in asterisks in a string', () => {
        const text = ' **strong1** and **strong2**';
        const matches = text.match(strongAsteriskRegexp);
        expect(Array.from(matches ?? [])).toEqual(['**strong1**', 'strong1']);
      });
    });

    describe('Underscore', () => {
      it('matches text enclosed in underscores', () => {
        const text = '__strong__';
        expect(strongUnderscoreRegexp.test(text)).toBe(true);
      });

      it('matches text enclosed in underscores along with included spaces', () => {
        const text = '__ strong   __';
        expect(strongUnderscoreRegexp.test(text)).toBe(true);
      });

      it('does not match text without underscores', () => {
        const text = 'strong';
        expect(strongUnderscoreRegexp.test(text)).toBe(false);
      });

      it('matches strong text which includes whitespace', () => {
        const text = '__strong text__';
        expect(strongUnderscoreRegexp.test(text)).toBe(true);
      });

      it('does not match single underscores', () => {
        const text = '_italics_';
        expect(strongUnderscoreRegexp.test(text)).toBe(false);
      });

      it('does not match invalid patterns', () => {
        const text1 = '__text_';
        const text2 = '__text';
        const text3 = '_text__';
        const text4 = 'text__';
        expect(strongUnderscoreRegexp.test(text1)).toBe(false);
        expect(strongUnderscoreRegexp.test(text2)).toBe(false);
        expect(strongUnderscoreRegexp.test(text3)).toBe(false);
        expect(strongUnderscoreRegexp.test(text4)).toBe(false);
      });

      it('matches only the first token enclosed in underscores in a string', () => {
        const text = ' __strong1__ and __strong2__';
        const matches = text.match(strongUnderscoreRegexp);
        expect(Array.from(matches ?? [])).toEqual(['__strong1__', 'strong1']);
      });
    });
  });

  describe('Emphasis mark regex patterns', () => {
    describe('Asterisk', () => {
      it('matches text enclosed in asterisks', () => {
        const text = '*em*';
        expect(emAsteriskRegexp.test(text)).toBe(true);
      });

      it('matches text enclosed in asterisks along with included spaces', () => {
        const text = '* em   *';
        expect(emAsteriskRegexp.test(text)).toBe(true);
      });

      it('does not match text without asterisks', () => {
        const text = 'em';
        expect(emAsteriskRegexp.test(text)).toBe(false);
      });

      it('matches emphasis text which includes whitespace', () => {
        const text = '*em text*';
        expect(emAsteriskRegexp.test(text)).toBe(true);
      });

      it('does not match double asterisks', () => {
        const text = '**strong**';
        expect(emAsteriskRegexp.test(text)).toBe(false);
      });

      it('does not match invalid patterns', () => {
        const text1 = '*text';
        const text2 = 'text*';
        expect(emAsteriskRegexp.test(text1)).toBe(false);
        expect(emAsteriskRegexp.test(text2)).toBe(false);
      });

      it('matches only the first token enclosed in asterisks in a string', () => {
        const text = ' *em1* and *em2*';
        const matches = text.match(emAsteriskRegexp);
        expect(Array.from(matches ?? [])).toEqual(['*em1*', 'em1']);
      });
    });

    describe('Underscore', () => {
      it('matches text enclosed in underscores', () => {
        const text = '_em_';
        expect(emUnderscoreRegexp.test(text)).toBe(true);
      });

      it('matches text enclosed in underscores along with included spaces', () => {
        const text = '_ em   _';
        expect(emUnderscoreRegexp.test(text)).toBe(true);
      });

      it('does not match text without underscores', () => {
        const text = 'em';
        expect(emUnderscoreRegexp.test(text)).toBe(false);
      });

      it('matches emphasis text which includes whitespace', () => {
        const text = '_em text_';
        expect(emUnderscoreRegexp.test(text)).toBe(true);
      });

      it('does not match double underscores', () => {
        const text = '__strong__';
        expect(emUnderscoreRegexp.test(text)).toBe(false);
      });

      it('does not match invalid patterns', () => {
        const text1 = '_text';
        const text2 = 'text_';
        expect(emUnderscoreRegexp.test(text1)).toBe(false);
        expect(emUnderscoreRegexp.test(text2)).toBe(false);
      });

      it('matches only the first token enclosed in underscores in a string', () => {
        const text = ' _em1_ and _em2_';
        const matches = text.match(emUnderscoreRegexp);
        expect(Array.from(matches ?? [])).toEqual(['_em1_', 'em1']);
      });
    });
  });

  describe('Code mark regex pattern', () => {
    it('matches text enclosed in backticks', () => {
      const text = '`code`';
      expect(codeBackticksRegexp.test(text)).toBe(true);
    });

    it('matches text with spaces inside backticks', () => {
      const text = '` code block `';
      expect(codeBackticksRegexp.test(text)).toBe(true);
    });

    it('does not match text without backticks', () => {
      const text = 'code';
      expect(codeBackticksRegexp.test(text)).toBe(false);
    });

    it('does not match empty backticks', () => {
      const text = '``';
      expect(codeBackticksRegexp.test(text)).toBe(false);
    });

    it('does not match three sequential backticks', () => {
      const text = '```';
      expect(codeBackticksRegexp.test(text)).toBe(false);
    });

    it('does not match double backticks', () => {
      const text = '``code``';
      expect(codeBackticksRegexp.test(text)).toBe(false);
    });

    it('matches only the first token enclosed in backticks in a string', () => {
      const text = ' `code1` and `code2`';
      const matches = text.match(codeBackticksRegexp);
      expect(Array.from(matches ?? [])).toEqual(['`code1`', 'code1']);
    });
  });
});
