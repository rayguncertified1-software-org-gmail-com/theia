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
import { TreeDecorator, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { Emitter } from '@theia/core/lib/common/event';
import { Tree } from '@theia/core/lib/browser/tree/tree';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { ApplicationShell, DepthFirstTreeIterator, LabelProvider } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { OpenEditorNode } from './navigator-open-editors-tree-model';
import { EditorPreviewWidget } from '@theia/editor-preview/lib/browser';

@injectable()
export class OpenEditorsFileDecorator implements TreeDecorator {
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(LabelProvider) protected readonly labelProvider: LabelProvider;
    @inject(ApplicationShell) protected readonly shell: ApplicationShell;

    readonly id = 'theia-open-editors-file-decorator';
    // THIS SHOULD FIRE ONLY WHEN SAVEABLE STATE CHANGES
    protected decorationsMap = new Map<string, TreeDecoration.Data>();

    protected readonly decorationsChangedEmitter = new Emitter();
    readonly onDidChangeDecorations = this.decorationsChangedEmitter.event;
    @postConstruct()
    init(): void {
        this.workspaceService.onWorkspaceChanged(event => {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
        });
        this.workspaceService.onWorkspaceLocationChanged(event => {
            this.fireDidChangeDecorations((tree: Tree) => this.collectDecorators(tree));
        });

        // this.shell.onDidAddWidget(widget => {
        //     const saveable = Saveable.get(widget);
        //     if (saveable) {
        //         this.toDisposeOnDirtyChanged.set(widget.id, saveable.onDirtyChanged(() => this.fireDidChangeDecorations());
        //     }
        // })
    }

    protected fireDidChangeDecorations(event: (tree: Tree) => Promise<Map<string, TreeDecoration.Data>>): void {
        this.decorationsChangedEmitter.fire(event);
    }

    async decorations(tree: Tree): Promise<Map<string, TreeDecoration.Data>> {
        return this.collectDecorators(tree);
    }

    protected async collectDecorators(tree: Tree): Promise<Map<string, TreeDecoration.Data>> {
        // Add add workspace root as caption affix and italicize if PreviewWidget
        const result = new Map<string, TreeDecoration.Data>();
        if (tree.root === undefined) {
            return result;
        }
        for (const node of new DepthFirstTreeIterator(tree.root)) {
            if (OpenEditorNode.is(node)) {
                const isPreviewWidget = node.widget.parent instanceof EditorPreviewWidget;
                const path = await this.resolvePathString(node.uri);
                const decorations: TreeDecoration.Data = {
                    captionSuffixes: [
                        {
                            data: path,
                            fontData: { style: isPreviewWidget ? 'italic' : undefined }
                        }
                    ],
                    fontData: { style: isPreviewWidget ? 'italic' : undefined }
                };
                result.set(node.id, decorations);
            }
        }
        return result;
    }

    protected async resolvePathString(nodeURI: URI): Promise<string> {
        const workspaceRoots = await this.workspaceService.roots;
        const parentWorkspace = workspaceRoots.find(({ resource }) => resource.isEqualOrParent(nodeURI));
        if (parentWorkspace) {
            const relativePathURI = parentWorkspace.resource.relative(nodeURI);
            const workspacePrefixString = workspaceRoots.length > 1 ? parentWorkspace.name : '';
            const filePathString = relativePathURI?.hasDir ? relativePathURI.toString() : '';
            const separator = filePathString && workspacePrefixString ? ' * ' : '';
            return `${workspacePrefixString}${separator}${filePathString}`;
        }
        return '';
    }
}
