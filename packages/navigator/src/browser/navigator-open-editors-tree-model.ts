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
import { ApplicationShell, CompositeTreeNode, Navigatable, Saveable, Widget } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';

@injectable()
export class OpenEditorsModel extends FileTreeModel {
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(EditorManager) protected readonly editorManager: EditorManager;
    counter = 0;

    protected openWidgets: Widget[];


    @postConstruct()
    protected init(): void {
        super.init();
        this.initializeRoot();
    }

    protected async initializeRoot(): Promise<void> {
        this.toDispose.push(this.applicationShell.onDidAddWidget(widget => {
            if (Saveable.get(widget)) {
                // event fires before applicationShell.widgets is updated
                setTimeout(async () => {
                    this.updateOpenWidgets();
                    this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
                    console.log('SENTINEL TREE', this.root);
                });
            }
        }));
        this.toDispose.push(this.applicationShell.onDidRemoveWidget(widget => {
            if (Saveable.get(widget)) {
                setTimeout(async () => {
                    this.updateOpenWidgets();
                    this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
                });
            }
        }));
        this.updateOpenWidgets();
        this.root = await this.buildRootFromOpenedWidgets(this.openWidgets);
        this.fireChanged();
    }

    protected updateOpenWidgets(): void {
        this.openWidgets = this.applicationShell.widgets.filter(widget => Saveable.get(widget));
    }

    protected async buildRootFromOpenedWidgets(widgets: Widget[]): Promise<CompositeTreeNode> {
        const newRoot: CompositeTreeNode = {
            id: 'open-editors:root',
            parent: undefined,
            visible: false,
            children: []
        };
        for (let widget of this.openWidgets) {
            if (Navigatable.is(widget)) {
                const uri = widget.getResourceUri();
                if (uri) {
                    const fileStat = await this.fileService.resolve(uri);
                    const nodeID = uri.path.toString();
                    const openEditorNode: FileStatNode = {
                        id: nodeID,
                        fileStat,
                        uri,
                        selected: false,
                        parent: undefined,
                        name: widget.title.label,
                        icon: widget.title.iconClass,
                        // children: []
                    }
                    CompositeTreeNode.addChild(newRoot, openEditorNode);
                }
            }

        }
        // this.openWidgets.forEach(widget => {
        // // });
        return newRoot;
    }
}
