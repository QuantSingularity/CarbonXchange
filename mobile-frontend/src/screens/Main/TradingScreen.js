import React, { useEffect, useRef, useState } from "react";
import { useRoute } from "@react-navigation/native";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/Card";
import Button from "../../components/Button";
import { marketApi, tradingApi, apiErrorMessage } from "../../services/api";
import { formatCurrency, formatNumber, humanize } from "../../utils/format";
import theme from "../../styles/theme";

const POLL_MS = 15000;
const ORDER_TYPES = ["market", "limit", "stop", "stop_limit"];

const TradingScreen = () => {
  const route = useRoute();
  const [symbolInput, setSymbolInput] = useState(
    route.params?.creditType || "",
  );
  const [symbol, setSymbol] = useState(route.params?.creditType || "");

  const [ticker, setTicker] = useState(null);
  const [depth, setDepth] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);

  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  const pollRef = useRef(null);

  const loadMarket = async (sym) => {
    if (!sym.trim()) {
      setTicker(null);
      setDepth(null);
      setRecentTrades([]);
      return;
    }
    setMarketLoading(true);
    try {
      const [t, d, r] = await Promise.allSettled([
        marketApi.ticker(sym),
        marketApi.depth(sym, 6),
        marketApi.recentTrades({ credit_type: sym, limit: 8 }),
      ]);
      setTicker(t.status === "fulfilled" ? t.value : null);
      setDepth(d.status === "fulfilled" ? d.value : null);
      setRecentTrades(r.status === "fulfilled" ? r.value.trades : []);
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    loadMarket(symbol);
    if (pollRef.current) clearInterval(pollRef.current);
    if (symbol.trim())
      pollRef.current = setInterval(() => loadMarket(symbol), POLL_MS);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [symbol]);

  const handleSubmitOrder = async () => {
    setFormMessage(null);
    const qty = Number(quantity);

    if (!symbol.trim())
      return setFormMessage("Look up a credit type above first.");
    if (!qty || qty <= 0)
      return setFormMessage("Enter a quantity greater than zero.");
    if (orderType !== "market" && (!price || Number(price) <= 0)) {
      return setFormMessage("Enter a limit price for non-market orders.");
    }

    setSubmitting(true);
    try {
      const { order } = await tradingApi.createOrder({
        order_type: orderType,
        side,
        quantity: qty,
        credit_type: symbol.trim(),
        price: orderType !== "market" ? Number(price) : undefined,
      });
      setFormMessage({
        success: true,
        text: `Order ${order.order_id} placed.`,
      });
      setQuantity("");
      setPrice("");
      loadMarket(symbol);
    } catch (err) {
      setFormMessage(apiErrorMessage(err, "We couldn't place that order."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchRow}>
          <Ionicons
            name="search"
            size={16}
            color={theme.colors.textMuted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. reforestation, VCS-REDD-2024…"
            placeholderTextColor={theme.colors.textMuted}
            value={symbolInput}
            onChangeText={setSymbolInput}
            autoCapitalize="none"
          />
          <TouchableOpacity
            onPress={() => setSymbol(symbolInput.trim())}
            style={styles.searchBtn}
          >
            <Text style={styles.searchBtnText}>Look up</Text>
          </TouchableOpacity>
        </View>

        {symbol.trim() ? (
          <>
            <Card style={styles.tickerCard}>
              <Text style={theme.typography.eyebrow}>{symbol}</Text>
              <Text style={styles.tickerValue}>
                {marketLoading && !ticker
                  ? "…"
                  : ticker
                    ? formatCurrency(ticker.value, ticker.currency)
                    : "No data yet"}
              </Text>
              {ticker && (
                <View style={styles.tickerMetaRow}>
                  <Text style={styles.tickerMeta}>
                    24h high{" "}
                    {ticker.high_24h ? formatCurrency(ticker.high_24h) : "—"}
                  </Text>
                  <Text style={styles.tickerMeta}>
                    24h low{" "}
                    {ticker.low_24h ? formatCurrency(ticker.low_24h) : "—"}
                  </Text>
                </View>
              )}
            </Card>

            <View style={styles.bookRow}>
              <Card style={styles.bookCol}>
                <Text style={styles.bookTitle}>Order book</Text>
                {!depth ||
                (depth.bids.length === 0 && depth.asks.length === 0) ? (
                  <Text style={styles.emptyText}>No open orders.</Text>
                ) : (
                  <>
                    {depth.asks
                      .slice(0, 4)
                      .reverse()
                      .map((a, i) => (
                        <View key={`ask-${i}`} style={styles.bookRowLine}>
                          <Text
                            style={[
                              styles.bookPrice,
                              { color: theme.colors.loss },
                            ]}
                          >
                            {formatCurrency(a.price)}
                          </Text>
                          <Text style={styles.bookQty}>
                            {formatNumber(a.quantity, 0)}
                          </Text>
                        </View>
                      ))}
                    <View style={styles.bookDivider} />
                    {depth.bids.slice(0, 4).map((b, i) => (
                      <View key={`bid-${i}`} style={styles.bookRowLine}>
                        <Text
                          style={[
                            styles.bookPrice,
                            { color: theme.colors.gain },
                          ]}
                        >
                          {formatCurrency(b.price)}
                        </Text>
                        <Text style={styles.bookQty}>
                          {formatNumber(b.quantity, 0)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </Card>

              <Card style={styles.bookCol}>
                <Text style={styles.bookTitle}>Recent trades</Text>
                {recentTrades.length === 0 ? (
                  <Text style={styles.emptyText}>No recent prints.</Text>
                ) : (
                  <FlatList
                    data={recentTrades}
                    scrollEnabled={false}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                      <View style={styles.bookRowLine}>
                        <Text style={styles.bookPrice}>
                          {formatCurrency(item.price)}
                        </Text>
                        <Text style={styles.bookQty}>
                          {formatNumber(item.quantity, 0)}
                        </Text>
                      </View>
                    )}
                  />
                )}
              </Card>
            </View>
          </>
        ) : (
          <Card style={styles.hintCard}>
            <Text style={theme.typography.body2}>
              Search a credit type above to see live pricing and depth.
            </Text>
          </Card>
        )}

        <Text
          style={[
            theme.typography.h3,
            { marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
          ]}
        >
          Order entry
        </Text>

        <View style={styles.sideToggle}>
          {["buy", "sell"].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSide(s)}
              style={[
                styles.sideBtn,
                side === s && {
                  backgroundColor:
                    s === "buy" ? theme.colors.gain : theme.colors.loss,
                },
              ]}
            >
              <Text
                style={[styles.sideBtnText, side === s && { color: "#fff" }]}
              >
                {s.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          horizontal
          data={ORDER_TYPES}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: theme.spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setOrderType(item)}
              style={[
                styles.typeChip,
                orderType === item && styles.typeChipActive,
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  orderType === item && styles.typeChipTextActive,
                ]}
              >
                {humanize(item)}
              </Text>
            </TouchableOpacity>
          )}
        />

        <Text style={theme.components.label}>Quantity (tCO₂e)</Text>
        <TextInput
          style={theme.components.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="100"
          placeholderTextColor={theme.colors.textMuted}
        />

        {orderType !== "market" && (
          <>
            <Text
              style={[theme.components.label, { marginTop: theme.spacing.md }]}
            >
              Limit price (USD)
            </Text>
            <TextInput
              style={theme.components.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="12.50"
              placeholderTextColor={theme.colors.textMuted}
            />
          </>
        )}

        {formMessage && (
          <Text
            style={[
              styles.formMessage,
              formMessage.success && styles.formMessageSuccess,
            ]}
          >
            {formMessage.success ? formMessage.text : formMessage}
          </Text>
        )}

        <Button
          title={`${side === "buy" ? "Buy" : "Sell"} ${symbol || "credits"}`}
          onPress={handleSubmitOrder}
          loading={submitting}
          variant={side === "sell" ? "danger" : "primary"}
          style={{ marginTop: theme.spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  bookCol: { flex: 1 },
  bookDivider: {
    backgroundColor: theme.colors.divider,
    height: 1,
    marginVertical: 6,
  },
  bookPrice: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    fontSize: 12,
  },
  bookQty: {
    color: theme.colors.textMuted,
    fontFamily: theme.fontFamily.mono,
    fontSize: 12,
  },
  bookRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  bookRowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  bookTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  emptyText: { color: theme.colors.textMuted, fontSize: 12 },
  formMessage: {
    backgroundColor: "#F6E7DE",
    borderRadius: theme.radius.md,
    color: theme.colors.loss,
    fontSize: 13,
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  formMessageSuccess: { backgroundColor: "#E4F3EB", color: theme.colors.gain },
  hintCard: { alignItems: "center", marginBottom: theme.spacing.md },
  root: { backgroundColor: theme.colors.background, flex: 1 },
  searchBtn: { paddingHorizontal: 10 },
  searchBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  searchInput: {
    color: theme.colors.text,
    flex: 1,
    fontFamily: theme.fontFamily.mono,
    fontSize: 13,
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    height: 46,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  sideBtn: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flex: 1,
    paddingVertical: 10,
  },
  sideBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  sideToggle: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    marginBottom: theme.spacing.md,
    padding: 4,
  },
  tickerCard: { marginBottom: theme.spacing.md },
  tickerMeta: { color: theme.colors.textMuted, fontSize: 12 },
  tickerMetaRow: { flexDirection: "row", gap: theme.spacing.lg, marginTop: 8 },
  tickerValue: {
    color: theme.colors.text,
    fontFamily: theme.fontFamily.mono,
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
  },
  typeChip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typeChipActive: { backgroundColor: theme.colors.primary },
  typeChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  typeChipTextActive: { color: theme.colors.primaryForeground },
});

export default TradingScreen;
