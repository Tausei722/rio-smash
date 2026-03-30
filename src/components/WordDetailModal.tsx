import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  english: string;
  japanese?: string | null;
  detail?: string | null;
  onClose: () => void;
};

export function WordDetailModal({ visible, english, japanese, detail, onClose }: Props) {
  // detail テキストをセクションに分割してレンダリング
  // 書式例:
  //   【品詞】形容詞
  //   【意味】賢い・気の利いた
  //   【使い方】
  //   That was a smart idea.
  //   She's very smart.
  //   【文法ポイント】
  //   形容詞として名詞の前や be動詞の後に置く。
  const sections = parseDetail(detail);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.english}>{english}</Text>
              {japanese ? <Text style={styles.japanese}>{japanese}</Text> : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {sections.length > 0 ? (
              sections.map((sec, i) => (
                <View key={i} style={styles.section}>
                  {sec.title ? (
                    <View style={styles.sectionTitleRow}>
                      <View style={styles.sectionTitleBar} />
                      <Text style={styles.sectionTitle}>{sec.title}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.sectionBody}>{sec.body}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyArea}>
                <Text style={styles.emptyText}>詳細情報がまだ登録されていません。</Text>
                <Text style={styles.emptyHint}>
                  管理者画面から単語を編集して{'\n'}「詳細・文法メモ」を追加できます。
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

type Section = { title: string | null; body: string };

function parseDetail(detail: string | null | undefined): Section[] {
  if (!detail?.trim()) return [];

  const lines = detail.split('\n');
  const sections: Section[] = [];
  let currentTitle: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join('\n').trim();
    if (body || currentTitle) {
      sections.push({ title: currentTitle, body });
    }
    bodyLines = [];
    currentTitle = null;
  };

  for (const line of lines) {
    const match = line.match(/^【(.+?)】\s*(.*)/);
    if (match) {
      flush();
      currentTitle = match[1];
      if (match[2]) bodyLines.push(match[2]);
    } else {
      bodyLines.push(line);
    }
  }
  flush();

  return sections;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  english: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0e7490',
  },
  japanese: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  body: {
    flex: 1,
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionTitleBar: {
    width: 4,
    height: 16,
    backgroundColor: '#06b6d4',
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0e7490',
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    paddingLeft: 12,
  },
  emptyArea: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
  },
  emptyHint: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: '#0e7490',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
