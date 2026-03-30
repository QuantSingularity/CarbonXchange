// mobile-frontend/__mocks__/axios.js

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockRequestUse = jest.fn((successCb, _errorCb) => {
  // Default behavior: call success callback. Can be overridden in tests if error path needs to be tested.
  // The successCb should be called with a config object.
  if (successCb) return Promise.resolve(successCb({ headers: {} }));
  return Promise.resolve({ headers: {} }); // Fallback
});
const mockResponseUse = jest.fn((successCb, _errorCb) => {
  // Default behavior: call success callback. Can be overridden in tests if error path needs to be tested.
  // The successCb should be called with a response object.
  if (successCb) return Promise.resolve(successCb({ data: {} }));
  return Promise.resolve({ data: {} }); // Fallback
});

const mockAxiosInstance = {
  post: mockPost,
  get: mockGet,
  interceptors: {
    request: { use: mockRequestUse },
    response: { use: mockResponseUse },
  },
};

const mockCreate = jest.fn(() => mockAxiosInstance);

// This is what gets imported when `import axios from 'axios'` is used in any file (including SUT).
export default {
  create: mockCreate,
  post: jest.fn(), // Mock static post if used directly
  get: jest.fn(), // Mock static get if used directly
  // Add other static methods if your SUT uses them e.g. axios.all, axios.spread

  // Expose the instance mocks if tests need to directly manipulate them
  // This is a bit unconventional for auto-mocks but can be a pattern.
  // Alternatively, tests will access them via axios.create().get etc.
  _mockInstance: mockAxiosInstance,
  _mockCreate: mockCreate,
  _mockPost: mockPost, // static post mock
  _mockGet: mockGet, // static get mock
};
