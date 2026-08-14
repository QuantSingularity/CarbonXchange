import React from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import theme from "../styles/theme";
import { explorerTxUrl, shortenHex } from "../utils/blockchain";

/**
 * Shows whether a credit has been tokenized on-chain. When a tx hash is
 * available, tapping the badge opens the configured block explorer so
 * anyone can independently verify the issuance transaction - the
 * platform's operator wallet is the sole on-chain actor (custodial
 * model), so this is a transparency/audit link, not a wallet action.
 */
const OnChainBadge = ({ isTokenized, txHash, style }) => {
  if (!isTokenized) {
    return (
      <View style={[styles.badge, styles.badgeNeutral, style]}>
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
          Not yet on-chain
        </Text>
      </View>
    );
  }

  const content = (
    <View style={[styles.badge, styles.badgeVerified, style]}>
      <Ionicons
        name="shield-checkmark-outline"
        size={12}
        color={theme.colors.gain}
        style={{ marginRight: 3 }}
      />
      <Text style={[styles.text, { color: theme.colors.gain }]}>
        Verified on-chain
      </Text>
      {!!txHash && (
        <Ionicons
          name="open-outline"
          size={12}
          color={theme.colors.textSecondary}
          style={{ marginLeft: 4 }}
        />
      )}
    </View>
  );

  if (!txHash) return content;

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(explorerTxUrl(txHash))}
      accessibilityRole="link"
      accessibilityLabel={`View transaction ${shortenHex(txHash)} on the block explorer`}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    ...theme.components.badge,
    alignItems: "center",
    flexDirection: "row",
  },
  badgeNeutral: { backgroundColor: theme.colors.surfaceMuted },
  badgeVerified: { backgroundColor: "#E4F3EB" },
  text: { fontSize: 12, fontWeight: "600" },
});

export default OnChainBadge;
