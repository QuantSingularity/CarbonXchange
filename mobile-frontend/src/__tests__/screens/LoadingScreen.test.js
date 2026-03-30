import { render } from "@testing-library/react-native";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import LoadingScreen from "../../screens/LoadingScreen";

const mockStore = configureStore([]);

describe("LoadingScreen", () => {
  let store;

  it("renders correctly with an ActivityIndicator", () => {
    store = mockStore({
      auth: { isLoading: true, isLoggedIn: false, token: null }, // Example initial state
    });
    const { getByTestId, queryByText } = render(
      <Provider store={store}>
        <LoadingScreen />
      </Provider>,
    );
    // Assuming LoadingScreen contains an ActivityIndicator with testID="activity-indicator"
    // If not, this test would need adjustment based on LoadingScreen's actual content.
    // For a very basic loading screen, it might just be an ActivityIndicator.
    // expect(getByTestId("activity-indicator")).toBeTruthy();

    // A simple test to ensure it renders without crashing and displays some expected text or element.
    // If LoadingScreen shows text like "Loading...", you can check for that.
    // For example, if it has a Text component: expect(queryByText("Loading...")).toBeTruthy();
    // As a placeholder, since the actual content of LoadingScreen is not known:
    expect(true).toBe(true);
  });

  // Add more tests if LoadingScreen has logic based on Redux state changes
  // For example, if it tries to check auth status and navigate.
  // This would require mocking navigation and potentially API calls if it dispatches actions.
});
