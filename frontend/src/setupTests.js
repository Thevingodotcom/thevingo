import '@testing-library/jest-dom';

// Mock window.scrollTo since jsdom does not implement it
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};
}
