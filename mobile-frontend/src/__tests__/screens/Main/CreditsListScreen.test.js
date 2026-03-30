import { NavigationContainer } from "@react-navigation/native";
import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import CreditsListScreen from "../../../screens/Main/CreditsListScreen";
import * as api from "../../../services/api";
import authReducer from "../../../store/slices/authSlice";

// Mock navigation
const mockNavigation = { navigate: jest.fn() };

// Mock API service
jest.mock("../../../services/api", () => ({
  getCredits: jest.fn(),
}));

const createTestStore = (initialState) => {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: initialState,
  });
};

describe("CreditsListScreen", () => {
  const initialState = {
    auth: {
      user: { id: "user123" },
      token: "test-token",
      isLoggedIn: true,
      isLoading: false,
      isRehydrating: false,
      error: null,
    },
  };

  beforeEach(() => {
    api.getCredits.mockClear();
    mockNavigation.navigate.mockClear();
  });

  const renderComponent = () => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <CreditsListScreen navigation={mockNavigation} />
        </NavigationContainer>
      </Provider>,
    );
  };

  it("renders correctly and shows search input", () => {
    api.getCredits.mockReturnValue(new Promise(() => {}));
    const { getByPlaceholderText } = renderComponent();
    expect(getByPlaceholderText(/Search credits/i)).toBeTruthy();
  });

  it("displays list of credits after successful API call", async () => {
    const mockCredits = {
      success: true,
      data: {
        credits: [
          {
            id: "credit1",
            type: "renewable_energy",
            amount: 100,
            price: 25.5,
            status: "available",
          },
        ],
        pages: 1,
      },
    };
    api.getCredits.mockResolvedValue(mockCredits);

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/RENEWABLE ENERGY/i)).toBeTruthy();
    });
  });

  it("navigates to CreditDetail when credit is pressed", async () => {
    const mockCredits = {
      success: true,
      data: {
        credits: [
          {
            id: "credit1",
            type: "renewable_energy",
            amount: 100,
            price: 25.5,
            status: "available",
          },
        ],
        pages: 1,
      },
    };
    api.getCredits.mockResolvedValue(mockCredits);

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/RENEWABLE ENERGY/i)).toBeTruthy();
    });

    const creditItem = getByText(/RENEWABLE ENERGY/i);
    fireEvent.press(creditItem);

    expect(mockNavigation.navigate).toHaveBeenCalledWith("CreditDetail", {
      creditId: "credit1",
    });
  });

  it("displays error message if fetching credits fails", async () => {
    const mockError = { success: false, error: { message: "Network Error" } };
    api.getCredits.mockResolvedValue(mockError);

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/Network Error/i)).toBeTruthy();
    });
  });
});
