/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject, postConstruct } from 'inversify';
import { FileStatNode, FileTreeModel } from '@theia/filesystem/lib/browser';
import { ApplicationShell, CompositeTreeNode, Navigatable, SelectableTreeNode, Widget } from '@theia/core/lib/browser';
import { EditorWidget } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { EditorPreviewManager, EditorPreviewWidget } from '@theia/editor-preview/lib/browser';
import { DisposableCollection } from '@theia/core/lib/common';
import { debounce } from 'lodash';

export interface OpenEditorNode extends FileStatNode {
    widget: Widget;
};

export namespace OpenEditorNode {
    export function is(node: object | undefined): node is OpenEditorNode {
        return FileStatNode.is(node) && 'widget' in node;
    }
}

@injectable()
export class OpenEditorsModel extends FileTreeModel {
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(EditorPreviewManager) protected readonly editorPreviewManager: EditorPreviewManager;

    protected toDisposeOnPreviewWidgetReplaced = new DisposableCollection();

    @postConstruct()
    protected init(): void {
        super.init();
        this.initializeRoot();
    }

    protected async initializeRoot(): Promise<void> {
        this.selectionService.onSelectionChanged(selection => {
            const { widget } = (selection[0] as OpenEditorNode);
            this.applicationShell.activateWidget(widget.id);
        });
        this.toDispose.push(this.applicationShell.onDidChangeCurrentWidget(async ({ newValue }) => {
            const nodeToSelect = this.tree.getNode(newValue?.id) as SelectableTreeNode;
            if (nodeToSelect) {
                this.selectNode(nodeToSelect);
            }
        }));
        this.toDispose.push(this.workspaceService.onWorkspaceChanged(() => this.updateOpenWidgets()));
        this.toDispose.push(this.workspaceService.onWorkspaceLocationChanged(() => this.updateOpenWidgets()));
        this.toDispose.push(this.applicationShell.onDidAddWidget(() => this.updateOpenWidgets()));
        this.toDispose.push(this.applicationShell.onDidRemoveWidget(() => this.updateOpenWidgets()));
        this.toDispose.push(this.editorPreviewManager.onCreated(previewWidget => {
            if (previewWidget instanceof EditorPreviewWidget) {
                this.toDisposeOnPreviewWidgetReplaced.dispose();
                this.toDisposeOnPreviewWidgetReplaced.push(previewWidget.onPinned(() => this.updateOpenWidgets()));
                this.toDisposeOnPreviewWidgetReplaced.push(previewWidget.onDidChangeTrackableWidgets(() => this.updateOpenWidgets()));
            }
        }));
        await this.updateOpenWidgets();
        this.fireChanged();
    }

    protected updateOpenWidgets = debounce(this.doUpdateOpenWidgets, 250);

    protected async doUpdateOpenWidgets(): Promise<void> {
        const editorWidgets = this.applicationShell.widgets.filter(widget => widget instanceof EditorWidget);
        this.root = await this.buildRootFromOpenedWidgets(editorWidgets);
    }

    protected async buildRootFromOpenedWidgets(openWidgets: Widget[]): Promise<CompositeTreeNode> {
        const newRoot: CompositeTreeNode = {
            id: 'open-editors:root',
            parent: undefined,
            visible: false,
            children: []
        };
        for (const widget of openWidgets) {
            if (Navigatable.is(widget)) {
                const uri = widget.getResourceUri();
                if (uri) {
                    const fileStat = await this.fileService.resolve(uri);
                    const openEditorNode: OpenEditorNode = {
                        id: widget.id,
                        fileStat,
                        uri,
                        selected: false,
                        parent: undefined,
                        name: widget.title.label,
                        icon: widget.title.iconClass,
                        widget
                    };
                    CompositeTreeNode.addChild(newRoot, openEditorNode);
                }
            }

        }
        return newRoot;
    }
}
