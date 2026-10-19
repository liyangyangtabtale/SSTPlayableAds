using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace SSTPlayable
{
    /// <summary>换装阶段：右侧圆角面板（顶部页签 + 2 列网格）+ 面板下方确认按钮。</summary>
    public class StagePanel : MonoBehaviour
    {
        public RectTransform panel, tabRow, grid;
        public GridLayoutGroup gridLayout;
        public OptionCell cellPrefab;
        public StageTab tabPrefab;
        public Button confirmButton;
        public Text confirmLabel;
        [Tooltip("页签行高度 + 网格上下内边距，用来算面板总高")] public float headerHeight = 130, bottomPadding = 20;

        OptionCell selected;

        public void Show(List<StageConfig> stages, int index, string confirmText, Action<OptionConfig> onPick, Action onConfirm)
        {
            gameObject.SetActive(true);
            var stage = stages[index];

            for (int i = tabRow.childCount - 1; i >= 0; i--) Destroy(tabRow.GetChild(i).gameObject);
            for (int i = 0; i < stages.Count; i++)
            {
                var tab = Instantiate(tabPrefab, tabRow);
                tab.gameObject.SetActive(true);
                tab.Bind(stages[i], i == index);
            }

            for (int i = grid.childCount - 1; i >= 0; i--) Destroy(grid.GetChild(i).gameObject);
            gridLayout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            gridLayout.constraintCount = stage.columns;
            selected = null;

            int n = 0;
            foreach (var o in stage.VisibleOptions())
            {
                var c = Instantiate(cellPrefab, grid);
                c.gameObject.SetActive(true);
                c.Bind(o, cell =>
                {
                    if (selected != null) selected.SetSelected(false);
                    selected = cell; cell.SetSelected(true);
                    confirmButton.interactable = true;
                    onPick(o);
                });
                n++;
            }

            int rows = Mathf.CeilToInt(n / (float)stage.columns);
            float gridH = rows * gridLayout.cellSize.y + Mathf.Max(0, rows - 1) * gridLayout.spacing.y;
            panel.sizeDelta = new Vector2(panel.sizeDelta.x, headerHeight + gridH + bottomPadding);

            confirmLabel.text = confirmText;
            confirmButton.interactable = false;
            confirmButton.onClick.RemoveAllListeners();
            confirmButton.onClick.AddListener(() => { if (confirmButton.interactable) onConfirm(); });
        }

        public void Hide() => gameObject.SetActive(false);
    }
}
