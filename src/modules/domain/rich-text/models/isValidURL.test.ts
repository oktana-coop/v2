import { isValidURL } from './link';

describe('isValidURL', () => {
  it('should return true for valid URLs', () => {
    expect(isValidURL('https://www.example.com')).toBe(true);
    expect(isValidURL('http://example.com')).toBe(true);
    expect(
      isValidURL('https://sub.domain.com/path?query=string#fragment')
    ).toBe(true);
    expect(isValidURL('mailto://www.example.com')).toBe(true);
    expect(isValidURL('any-arbitrary-protocoll://www.example.com')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(isValidURL('examplecom')).toBe(false);
    expect(isValidURL('example.com')).toBe(false);
    expect(isValidURL('http//example.com')).toBe(false);
  });
});
