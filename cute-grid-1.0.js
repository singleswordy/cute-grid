/**
 * 
 * cute-grid 表格插件
 * @version 1.0.0
 * 
 * @author  LIBO
 * @date    2016年5月27日上午11:32:04
 * @depends jQuery1.9+, artTemplate2.0
 * @description
 *          v1.0.0      1.通用表格功能，静态及动态数据加载（ajax），加载时loading
 *                      2.按列排序，分页
 *                      3.表头固定，表格体纵向滚动
 *                      4.前N列固定，其他列横向滚动
 *                      5.支持表格宽度高度自适应，支持表格列宽度自适应
 *                      6.多事件支持：onBeforeLoad,onLoad,onLoadError,onSelect,onUnselect,onBeforSelect,onBeforeUnSelect
 *                      7.支持以下api: reload;resize;select;deselect;getSelected;
 *
 *          useage:     $('#my-grid').cuteGrid({
 *                          'url' : '{path to get json data}',
 *                          'cols' : [
 *                              {index:'{col.key}',display:'{列显示名称}',width:'{列宽度}'},
 *                              {index:'{col.key}',display:'{列显示名称}',width:'{列宽度}',},
 *                              ...
 *                          ]
 *                      });
 *                      
 *                      -- for config item detail,look at CuteGrid.fn.defaults and CuteGrid.fn.colsDefaults 
 *
 *          unfixed bug list:
 *                      1.暂不支持列内容较多，超过列宽时的浮动显示或者换行，所以列内容太多时会有被截断的现象。
 *                      2.单页面多实例时支持有问题
 *
 *
 */

;(function($,template,window,undefined){

    var CuteGrid = function(options , args){
        var that = this,
            gridInstance; // grid 实例

        if( that.length ){
            // 执行已初始化的grid对象的方法
            if(typeof options === 'string'){
                gridInstance = $(that).data('grid-instance');
                if( typeof gridInstance === 'undefined'){
                    _consoleLog('cute-grid对象尚未初始化,请先初始化！','error');
                    return false;
                } else if(/^load|reload|resize|select|deselect|getSelected$/.test(options) != true){
                    _consoleLog('不支持的方法：' + options,'error');
                    return false;
                }
                return gridInstance[options](args);
            } else if(typeof options === 'object'){
                options.content = $(that);
            }
        } else {
            _consoleLog('调用姿势错误:是不是id或者class写错了？','error');
            return false;
        }
        return new CuteGrid.prototype.init( options );
    };

    CuteGrid.version = '1.0.0'; // 版本号
    CuteGrid.list = []; // 支持多个实例
    CuteGrid.constants = {
        GRID_SCROLL_BAR_SIZE : 8,       // 滚动条的宽度（纵向）／高度（横向）
        GRID_HEAD_HEIGHT: 53,           // 表头高度
        GRID_ROW_HEIGHT : 40,           // 表格行高
        GRID_COL_DEFAULT_WIDTH : 140    // 列未指定列宽时，默认的宽度
    };

    CuteGrid.fn = CuteGrid.prototype = {
        constructor : CuteGrid,// 构造器

        /**
         * 初始化方法
         */
        init : function( options ){
            var that = this;
            var opts = $.extend( true , {} , that.defaults, options);
            var $content = opts.content;

            // 纪录原始配置
            that.orignalOptions = $.extend( true , {}  , opts);
            // params 使用引用而不是值
            opts.params = options.params || {};

            // 数据加载类型
            opts.dataType = opts.data && $.isArray(opts.data) && opts.data.length > 0 ? 'static' : 'dynamic';
            
            // 保存配置
            that.options = opts;

            // 初始化列配置
            var curColIsFixed = false;
            for(var i=0; i< opts.cols.length ; i++){
                opts.cols[i] = $.extend( true , {} , that.colsDefaults , opts.cols[i]);
                if (curColIsFixed == false && opts.cols[i].isFixed == true) {
                    if (i == 0) { 
                        curColIsFixed = true;
                    } else {
                        that._log('There is cols which is not fixed (property isFixed = false) before col "' + opts.cols[i].index + '" ');
                        return false;
                    }
                };
            }

            /*
             * @todo
             * 支持 autoload = false
             */

            // 计算容器尺寸
            that._getContainerSize();
             
            // 默认初始化时自动加载数据
            that.load();

            // 存储引用对象
            opts.content.data('grid-instance' , that);
            CuteGrid.list.push(that);

        }, 
        /**
         * 加载数据
         * @param data      待加载的数据
         * @param useProxy  是否使用dataProxy
         */
        load : function(data,useProxy){
            var that = this, 
                opts = that.options,
                $content = opts.content;

            // 先渲染遮罩，render渲染后自动解除
            that._mask();
            that._log(opts.data);

            if( data){
                that._render(data);
            // 静态的    
            } else if( opts.data && $.isArray(opts.data) && opts.data.length > 0) {
                that._log('dddd');
                opts.dataRows = opts.data;
                opts.dataCount = opts.data.length;

                /*
                 * @todo 静态数据的分页实现
                 */

                that._render({'list':opts.dataRows,'count':opts.dataCount});
            // ajax的
            } else if( opts.url){
                //如果存在活动的ajax对象则终止
                // that.ajax && that.ajax.status !== 200 && that.ajax.abort();

                // 解决没有传分页参数的问题
                if ( !opts.params.page || !opts.params.rows ) {
                    opts.params.page = 1;
                    opts.params.rows = opts.pageSizeList[0];
                };

                // 发起ajax请求
                that.ajax = $.ajax({
                    url: opts.url,
                    type: opts.type,
                    dataType: 'json',
                    data: opts.params,
                    beforeSend:function(XMLHttpRequest){
                        opts.onBeforeLoad && $.isFunction(opts.onBeforeLoad) && opts.onBeforeLoad.call(that,XMLHttpRequest);
                    },
                    success:function(response){
                        // 支持数据源代理(在接口协议不一致的情况下有用)
                        if( useProxy && $.isFunction(opts.dataProxy)){
                            response = opts.dataProxy(response);
                        } 
                        // 读取数据
                        if (response && response.result === 0) {
                            opts.rawData = response.data;
                            opts.dataRows = response.data.list;
                            opts.dataCount = response.data.count || response.data.list.length;
                            // load
                            that.load(response.data,true);
                        } else {
                            opts.runtime.errorText = response ? '加载数据错误：' + response.message + '(' + response.result +')' : '数据格式错误';
                            that._render(null);　
                        }
                    },
                    error:function(response){
                        if( response.status === 0){ // ajax.abort 主动终止
                            return;
                        } 
                        opts.runtime.errorText =  'ajax请求错误：' + response.responseText || '未知错误';
                        that._render(null);
                    }
                });
            }
        }, 
        // 重新加载
        reload : function(){
            var that = this;
            that.load();
        } , 
        // 选中
        select:function(rowIndex){
            var that = this, 
                opts = that.options,
                $tbody = $('.cute-grid-tbody',opts.content);

                $('.cute-grid-row',$tbody).each(function(index,item){
                    if ( rowIndex == "all" || $(item).attr('rindex') == rowIndex ) {
                        if( !$.isFunction(opts.onBeforeSelect) || opts.onBeforeSelect() !== false ){
                            $(item).addClass('cute-grid-row-selected');
                            $('.cute-grid-ck',$(item)).prop('checked',true);
                        } else {
                            $('.cute-grid-ck',$(item)).prop('checked',false);
                        }
                        if(rowIndex != "all" && $(item).attr('rindex') == rowIndex){
                            return false;
                        }
                    };
                });
                // 执行选中后的回调
                $.isFunction(opts.onSelect) && opts.onSelect();

        }, 
        // 取消选中
        deselect:function(rowIndex){
            var that = this, 
                opts = that.options,
                $tbody = $('.cute-grid-tbody',opts.content);
            
            $('.cute-grid-row',$tbody).each(function(index,item){
                if ( rowIndex == "all" || $(item).attr('rindex') == rowIndex ) {
                    if( !$.isFunction(that.onBeforeUnSelect) || that.onBeforeUnSelect( ) !== false ){
                        $(item).removeClass('cute-grid-row-selected');
                        $('.cute-grid-ck',$(item)).prop('checked',false);
                    } else {
                        $('.cute-grid-ck',$(item)).prop('checked',true);
                    }
                    if(rowIndex != "all" && $(item).attr('rindex') == rowIndex){
                        return false;
                    }
                };
            });
            // 执行选中后的回调
            $.isFunction(opts.onUnSelect) && opts.onUnSelect();
        }, 
        // 获取选中的行（data）
        getSelected:function(){
            var that = this, 
                opts = that.options,
                $tbody = $('.cute-grid-tbody',opts.content);
            return $('.cute-grid-row',$tbody).map(function(index,item){
                if( $(item).hasClass('cute-grid-row-selected') ){
                    var rowData = opts.dataRows[$(item).attr('rindex')];
                    rowData._row = $(item);
                    return rowData;
                }
            });
        }, 

        _getPager:function(){
            var that = this,
                opts = that.options;

            opts.params.page = opts.params.page || 1;
            opts.params.rows = opts.params.rows || opts.pageSizeList[0];
            opts.pager = {
                pageNo: opts.params.page,
                pageSize: opts.params.rows,
                pageSizeList : opts.pageSizeList,
                pageNumList : [],
                rowsTotal : opts.dataCount || 0,
                pageTotal : Math.ceil(opts.dataCount / opts.params.rows ) || 0
            };
            // 最多显示10个页码
            for (var i = 1; i <= opts.pager.pageTotal && i <= 10 ; i++) {
                opts.pager.pageNumList.push(i);
            };
        },

        // 排序
        _sort:function(){
            var that = this, 
                opts = that.options;

            if ( opts.dataType == 'static' ) {
                var sortedData = sortData(opts.dataRows,opts.params.orderBy,opts.params.sort);
                that.load(sortedData);
            } else {
                that.load();
            }

            // 二维数组排序
            function sortData(data,orderBy,sort){
                return data.sort(function(x,y){
                    if (x.orderBy && y.orderBy && x.orderBy > y.orderBy && sort.toUpperCase() == 'ASC') {
                        return 1;
                    } else {
                        return -1;
                    }
                });
            }
        },

        // 渲染（不计算，只渲染）
        _render:function(data,isResize){
            var that = this, 
                opts = that.options,
                $content = opts.content;

            // 检查data格式  list ， count 
            if ( data && data.count && $.isArray(data.list) && data.list.length > 0) {
                // ok
            } else if (data && data.count === 0) {
                opts.runtime.errorText = '暂无数据！';
            } else {
                opts.runtime.errorText = opts.runtime.errorText || '数据加载失败！';
                opts.runtime.errorText = '<span style="color:red;">' + opts.runtime.errorText + '</span>';
                // onload
                opts.onLoadErr && opts.onLoadErr.call( that, data, opts.runtime.errorText);
            }

            // 待渲染的数据
            var finalData = $.extend(true,{},data);

            // 列值重新渲染----- 因 artTemplate 简单模式对自定义函数支持有问题暂未解决，模版渲染前重新包装下数据
            $.each(finalData.list,function(rIndex,row){
                $.each(opts.cols,function(cIndex,col){
                    if ( col.renderer && $.isFunction(col.renderer)) {
                        finalData.list[rIndex][col.index] = col.renderer(finalData.list[rIndex][col.index],finalData.list[rIndex]);
                    };
                });
            });

            // 计算内容尺寸
            that._getContentSize();

            // 计算分页数据
            that._getPager();

            var templateData = {cols:opts.cols,
                rows:finalData.list,
                orderBy:opts.params.orderBy,
                sort:opts.params.sort,
                pager:opts.pager,
                runtime:opts.runtime,
                colDefaultWidth:CuteGrid.constants.GRID_COL_DEFAULT_WIDTH
            };
            // 渲染
            var contentWidth = $content.width();
            var scrollbarSize = _getScrollbarSize();
            var renderTemplate = template.compile(that.tmpl);
            $content.addClass('cute-grid').html(renderTemplate(templateData));

            // fix resize bug:当页面缩放，高度缩小时，因为缩小的过程中浏览器会出现滚动条，所以  opts.runtime.container.innerWidth  会比实际情况少15像素
            if ( $content.width() - contentWidth == scrollbarSize && opts.runtime.isReflow != true) {
                that._log('resize to reflow because of scrollbar size calculte error.');
                // 重新渲染一次
                that.resize($content.width() - 2);
                opts.runtime.isReflow = false;
            };

            // 绑定事件
            that._bindEvents();

            // onload
            !isResize && opts.onLoad && opts.onLoad.call( that, data);

        }, 
        // 
        resize:function( containerInnerWidth ){
            var that = this, 
                opts = that.options;
            that._log('resize');
            // 获得最新的容器尺寸
            that._getContainerSize(containerInnerWidth);
            // 重新渲染
            that._render({count:opts.dataCount,list:opts.dataRows},true);
        },

        // 计算表格容器的尺寸（包含进度条）
        _getContainerSize:function( containerInnerWidth ){
            var that = this, 
                opts = that.options,
                $content = opts.content;
            // 渲染时计算出的各数值
            opts.runtime = opts.runtime || {}; 
            opts.runtime.container = {};
            opts.runtime.content = {};
            opts.runtime.vSb = {};
            opts.runtime.hSb = {};

            // grid-main容器的高度（不含进度条，进度条占用的高度算在padding-bottom中）
            opts.runtime.container.height = opts.height || 0; 
            opts.runtime.container.minHeight = 0;
            var marginTop = parseInt($content.css('margin-top'));
            var marginBottom = parseInt($content.css('margin-bottom'));
            // 高度
            if ( opts.height == 'auto' ) {
                opts.runtime.container.height = $(window).height() - $content.offset().top - 76 - marginTop - marginBottom;
            } else if( parseInt(opts.height) > 0 ) {
                opts.runtime.container.height = opts.height;
            } else {
                opts.runtime.container.minHeight = opts.minHeight ? opts.minHeight : (opts.params.rows || opts.pageSizeList[0]) * CuteGrid.constants.GRID_ROW_HEIGHT + CuteGrid.constants.GRID_HEAD_HEIGHT;
                opts.runtime.container.height  = opts.runtime.container.minHeight;
            }
            
            // 修正模式下,容器宽度由传入的参数决定（fix bug）
            if ( containerInnerWidth ) {
                opts.runtime.isReflow = true;
                opts.runtime.container.innerWidth = containerInnerWidth;
            } else {
                // grid-main容器的宽度（含进度条，不含进度条的宽度为width）
                opts.runtime.container.innerWidth = $content.width() - 2;// 需要去掉左右两侧边框2px
            }
        },

        // 计算表格容器尺寸(只计算，不渲染)
        _getContentSize:function(){
            var that = this, 
                opts = that.options,
                $content = opts.content;
            var dataRowsLen = opts.dataRows && opts.dataRows.length ? opts.dataRows.length : 0;

            //渲染时计算出的各数值
            opts.runtime = opts.runtime || {}; 
            
            /*------- 计算内容高度 -------*/ 
            opts.runtime.content.height = dataRowsLen * CuteGrid.constants.GRID_ROW_HEIGHT + CuteGrid.constants.GRID_HEAD_HEIGHT;             // 内容高度

            // 纵向滚动条判断
            opts.runtime.vSb.show = false; // 默认没有纵向滚动条
            opts.runtime.container.paddingRight = 0;
            opts.runtime.container.width = opts.runtime.container.innerWidth;
            if ( opts.height && opts.runtime.content.height > opts.runtime.container.height ) {
                opts.runtime.vSb.show = true; // 有纵向滚动条
                opts.runtime.container.paddingRight = CuteGrid.constants.GRID_SCROLL_BAR_SIZE; // 留下纵向滚动条的位置
                opts.runtime.container.width = opts.runtime.container.innerWidth - opts.runtime.container.paddingRight;// 重新计算容器宽度
            }

            /*------- 计算内容宽度 -------*/
            opts.runtime.noWidthCols = [];// 记录没有设置宽度列序数

            opts.runtime.content.width = 40;                                 // 内容宽度(初始值,checkbox占用的宽度)
            opts.runtime.content.orignalWidth = 40;
            // 计算总宽度
            $.each(opts.cols,function(index,item){
                if ( parseInt(item.width) < 1) {
                    item.width = 0;
                    item._width = CuteGrid.constants.GRID_COL_DEFAULT_WIDTH;
                    opts.runtime.noWidthCols.push(index);
                } else {
                    item._width = item.width;
                }
                opts.runtime.content.width += item._width; // 纪录真实值
                opts.runtime.content.orignalWidth += item.width;// 纪录原始值
            });
            // 横向滚动条判断
            if (opts.runtime.content.width <= opts.runtime.container.width) {
                $.each(opts.runtime.noWidthCols,function(index,item){
                    opts.cols[item]._width = parseInt( (opts.runtime.container.width - opts.runtime.content.orignalWidth ) / opts.runtime.noWidthCols.length );
                });
                opts.runtime.content.width = opts.runtime.container.width;
                opts.runtime.hSb.show = false; // 没有横向滚动条
            } else {
                $.each(opts.runtime.noWidthCols,function(index,item){
                    opts.cols[item]._width = CuteGrid.constants.GRID_COL_DEFAULT_WIDTH;
                });
                opts.runtime.hSb.show = true;  // 有横向滚动条
                opts.runtime.container.paddingBottom = CuteGrid.constants.GRID_SCROLL_BAR_SIZE;
            }

            // 计算列的左偏移量
            var positionLeft = 40;// 当前的left位移：checkbox占用的宽度 + padding-left
            for(var i=0; i< opts.cols.length ; i++){
                opts.cols[i].pLeft =  positionLeft;
                positionLeft = opts.cols[i].pLeft + (opts.cols[i].width || opts.cols[i]._width) ;
            }

            /*------- 计算滚动条大小 -------*/
            // 滚动比率
            var vScrollRate = opts.runtime.container.height / opts.runtime.content.height;
            var hScrollRate = opts.runtime.container.width / opts.runtime.content.width;

            /*
             * @todo if(content.height = 0);
             */

            // 初始化
            opts.runtime.hSb.conBox =   {left:0,top:0,width:0,height:0};
            opts.runtime.hSb.box =      {left:0,top:0,width:0,height:0};
            opts.runtime.vSb.conBox =   {left:0,top:0,width:0,height:0};
            opts.runtime.vSb.box =      {left:0,top:0,width:0,height:0};

            // 有横向滚动条
            if (opts.runtime.hSb.show) {
                var hScrollbarConWidth = opts.runtime.container.width;
                var hScrollbarWidth = hScrollbarConWidth * hScrollRate;
                var hScrollbarCanScrollWidthMax = hScrollbarConWidth - hScrollbarWidth;
                // 滚动条滚动，相对于内容滚动的比率
                opts.runtime.hSb.scrollRate = (hScrollbarCanScrollWidthMax)/(opts.runtime.content.width - opts.runtime.container.width);
                opts.runtime.hSb.scrollMaxWidth = hScrollbarCanScrollWidthMax;

                // css 数值              
                opts.runtime.hSb.conBox = { 
                    left:0,
                    top:opts.runtime.container.height,
                    width:hScrollbarConWidth,
                    height:CuteGrid.constants.GRID_SCROLL_BAR_SIZE };
                opts.runtime.hSb.box = { 
                    left:0,
                    top:0,
                    width:hScrollbarWidth,
                    height:CuteGrid.constants.GRID_SCROLL_BAR_SIZE };
            };

            // 有纵向滚动条
            if (opts.runtime.vSb.show) {
                var vScrollbarConHeight = opts.runtime.container.height;
                var vScrollbarHeight = vScrollbarConHeight * vScrollRate;
                var vScrollbarCanScrollHeightMax = vScrollbarConHeight - vScrollbarHeight;
                // 滚动条滚动，相对于内容滚动的比率
                opts.runtime.vSb.scrollRate = vScrollbarCanScrollHeightMax/(opts.runtime.content.height - opts.runtime.container.height);
                opts.runtime.vSb.scrollMaxHeight = vScrollbarCanScrollHeightMax;

                // css 数值 
                opts.runtime.vSb.conBox = { 
                    left:opts.runtime.container.width,
                    top:0,
                    width:CuteGrid.constants.GRID_SCROLL_BAR_SIZE,
                    height:vScrollbarConHeight};
                opts.runtime.vSb.box = {
                    left:0,
                    top:0,
                    width:CuteGrid.constants.GRID_SCROLL_BAR_SIZE,
                    height:vScrollbarHeight
                };
            };

            /* 
             * @todo  计算横向滚动条最小宽度，限制 cute-grid-main 最小宽度，防止浏览器宽度过小时，滚动条消失
             */ 

        },

        // loading时的遮罩,open = true时，显示遮罩
        _mask:function(){
            var that = this, 
                opts = that.options,
                $content = opts.content;

            that._log('msk');
            that._getContainerSize();
            // 渲染loading页面
            var renderLoadingTemplate = template.compile(that.loadingTmpl);
            $content.addClass('cute-grid').html(renderLoadingTemplate( {runtime:opts.runtime} ));
        },  

        // 绑定事件
        _bindEvents:function(){
            var that = this, 
                opts = that.options,
                $content = opts.content,
                $gridMain = $('.cute-grid-main', $content),
                $head = $('.cute-grid-thead',$content);

            // 绑定列头排序事件    
            $('.cute-grid-cell',$head).on('click',function(){
                var $cell = $(this);
                if($('.cute-grid-sorttype',$cell).length > 0){
                    opts.params.sort = $('.cute-grid-sorttype',$cell).hasClass('cute-grid-sorttype-up') ? 'DESC' : 'ASC';
                    opts.params.orderBy = $cell.attr('cindex');
                    that._sort();
                }
            });

            // 绑定全选/取消全选事件
            $('.cute-grid-ck-selectall').on('click',function(){
                if( $('.cute-grid-ck-selectall').prop('checked') == true ){
                    that.select('all');
                } else {
                    that.deselect('all');
                }
            });

            // 绑定选中/取消选中单行事件
            $('.cute-grid-row').on('click',function(e){
                var rowIndex = $(this).attr('rIndex');
                if( $(this).hasClass('cute-grid-row-selected') ) {
                    that.deselect( rowIndex );
                } else {
                    that.select( rowIndex );
                }
                e.stopPropagation();
            });

            // 绑定分页条事件
            $('.cute-grid-pagerbar-pages a').on('click',function(){
                opts.params.page = $(this).text();
                that.reload();
            });
            // 前一页
            $('.cute-grid-pagerbar-prev').on('click',function(){
                opts.params.page = opts.params.page - 1 || 1;
                that.reload();
            });
            // 下一页
            $('.cute-grid-pagerbar-next').on('click',function(){
                opts.params.page = opts.params.page + 1 > opts.pager.pageTotal ? opts.params.page : opts.params.page + 1;
                that.reload();
            });
            $('.cute-grid-pagesize-select').on('change',function(){
                opts.params.rows = $(this).val();
                opts.params.page = 1;
                that.reload();
            });

            // 增加定时器避免resize事件被过多调用,$().resize() 有bug，换用 $().resizeEnd()
            $(window).resizeEnd({delay:100},function(){
                that.resize();
            });

            // 绑定横向滚动条拖拽事件
            bindDragEvents($('.cute-grid-h-scrollbar-bar'), 'horizontal', opts.runtime.hSb.scrollMaxWidth, function(){
                $('.cute-grid-h-scrollbar-bar').addClass('cute-grid-scrollbar-bar-dragging');// 鼠标点下时改变进度条样式
                $('.cute-grid-main').addClass('unselectable');
            },function( offsetX,offsetY ){
                offsetX = offsetX || 0;
                offsetX = offsetX / opts.runtime.hSb.scrollRate;
                // 向左移动 offsetX
                $('.cute-grid-t-inner').css({"left": offsetX*-1+ 'px'});
                $('.cute-grid-main .cute-grid-cell-fixed').css({'margin-left': offsetX + 'px'});
            },function(){
                $('.cute-grid-h-scrollbar-bar').removeClass('cute-grid-scrollbar-bar-dragging');//松开鼠标后恢复样式
                $('.cute-grid-main').removeClass('unselectable'); 
            });

            // 绑定纵向滚动条拖拽事件
            bindDragEvents($('.cute-grid-v-scrollbar-bar'), 'vertical', opts.runtime.vSb.scrollMaxHeight, function(){
                $('.cute-grid-v-scrollbar-bar').addClass('cute-grid-scrollbar-bar-dragging');// 鼠标点下时改变进度条样式
                $('.cute-grid-main').addClass('unselectable');
            },function( offsetX,offsetY ){
                offsetY = offsetY || 0;
                // 向左移动 offsetX
                $('.cute-grid-tbody .cute-grid-t-inner').css({"top": (offsetY/opts.runtime.vSb.scrollRate)*-1+ 'px'});
            },function(){
                $('.cute-grid-v-scrollbar-bar').removeClass('cute-grid-scrollbar-bar-dragging');//松开鼠标后恢复样式
                $('.cute-grid-main').removeClass('unselectable'); 
            });

            /*** 
             * 绑定拖拽事件
             * 
             * @params $dragObj             拖动的对象
             * @params direction            "horizontal" or "vertical"
             * @params offsetMax            拖动的最大限制（px）
             * @params mousedownCallback    鼠标点下时的回调
             * @params mousemoveCallback    鼠标移动时的回调
             * @params mouseupCallback      鼠标松开时的回调
             * 
             */
            function bindDragEvents ( $dragObj, direction, offsetMax, mousedownCallback, mousemoveCallback, mouseupCallback ) {
                var _move = false;// 移动标记  
                var _x, _y;//鼠标的坐标  
                $dragObj.mousedown(function(e){  
                    _move = true;  
                    _x = e.pageX - parseInt($dragObj.css('left')); 
                    _y = e.pageY - parseInt($dragObj.css('top')); 
                    $.isFunction( mousedownCallback ) && mousedownCallback();
                });  
                $(document).mousemove(function(e){  
                    if(_move){ 
                        if ( direction == 'horizontal') {
                            var x = e.pageX - _x; // 移动时根据鼠标位置计算向右便宜量
                            if (x < 0) { x = 0};
                            if (x > offsetMax) { x = offsetMax;}
                            $dragObj.css({'left':x + 'px'}); // 拖动对象新位置  
                        } else if( direction == 'vertical' ) {
                            var y = e.pageY - _y; // 移动时根据鼠标位置计算向右便宜量
                            if (y < 0) { y = 0};
                            if (y > offsetMax) { y = offsetMax;}
                            $dragObj.css({'top':y + 'px'}); // 拖动对象新位置 
                        } else {
                            // @todo
                        }
                        $.isFunction( mousemoveCallback ) && mousemoveCallback(x,y);//
                    }  
                }).mouseup(function(){  
                    _move = false; 
                    $.isFunction( mouseupCallback ) && mouseupCallback();//
                }); 
            } // end of bindDragEvents
        },
        // 纪录日志
        _log:function(message,level){
            if (this.options.debug) { 
                _consoleLog(message,level);
            };
        }
    }

    // 跟踪日志
    var _consoleLog = function(message,level){
        message = message || '[empty] Just a log at ' + new Date().toLocaleString();
        level = level || 'debug';
        if(typeof console != undefined && typeof console[level] == 'function') {
            if ( typeof message === 'object') {
                console[level]( '[' + level + '][object]:');
                console[level](message);
            } else {
                message = '[' + level + ']' + message;
                console[level](message);
            }
        };
    }

    var _getScrollbarSize = function(){
        if (CuteGrid._scrollbarSize) { return CuteGrid._scrollbarSize};
        var scrollDiv = document.createElement("div");
        scrollDiv.style.overflow = 'scroll';
        document.body.appendChild(scrollDiv);
        var scrollbarSize = scrollDiv.offsetWidth - scrollDiv.clientWidth;
        document.body.removeChild(scrollDiv);
        return CuteGrid._scrollbarSize = scrollbarSize;
    }

    // 可用的参数及默认值设置
    CuteGrid.fn.defaults = {
        cols : [],                                      // [must]       列配置数组，定义所有的列
        height:0,                                       // [optional]   高度，默认不限
        minHeight:0,                                    // [optional]   最小高度，默认为最小分页行数下的高度
        params : {                                      // [optional]   ajax请求的参数
            page : 1,                                   // [optional]   分页页数
            rows : 10,                                  // [optional]   分页每页行数
            orderBy : '',                               // [optional]   排序的列，值必须为 col 对应的 index
            sort : ''                                   // [optional]   排序类型，值只能为：ASC or DESC 
        },
        type: 'GET',                                    // [optional]   ajax请求类型
        pagebar : true,                                 // [optional]   分页条
        pageSizeList : [10,30,50,100],                  // [optional]   分页大小序列
        data : [],                                      // [optional]   数据源，静态数据时使用此属性
        url : '',                                       // [optional]   ajax 请求时使用此url 加载数据
        dataProxy: function( originalData ){            // [optional]   ajax 返回数据代理层，支持后端非标准协议
            return originalData;
        }, // 数据适配
        // 数据加载过程中触发的事件
        onBeforeLoad: function(){},                     // [optional]   数据加载前执行的回调
        onLoad : function(){},                          // [optional]   数据加载完成后执行的回调
        onLoadErr: function(){},                        // [optional]   数据加载失败后执行的回调 
        // 选中后触发的事件
        onBeforeSelect : function(){},                  // [optional]   选中前执行的回调，return false 则阻止选中
        onBeforeUnSelect : function(){},                // [optional]   取消选中前执行的回调，return false 则阻止取消选中
        onSelect :  function(){},                       // [optional]   选中后的回调
        onUnSelect : function(){},                      // [optional]   取消选中后的回调
        debug : false                                   // [optional]   debug模式，默认关闭
    };


    // 列配置参数默认值设置
    CuteGrid.fn.colsDefaults = {
        index: '',                                      // [must]        data 中每一列对应的key
        display: '',                                    // [must]        列的显示名
        width: 0,                                       // [optional]    固定宽度，为0时默认自适应宽度
        align: 'center',                                // [optional]    左右对齐 left right
        sortable: false,                                // [optional]    是否支持排序
        fixed:false,                                    // [optional]    是否固定在表格左侧，不随横向滚动条移动
        renderer: function(v,r){return v;}              // [optional]    渲染函数
    };


    // 表格渲染模版 
    CuteGrid.fn.tmpl = [
        '<!-- 表格头和表格主体的包裹容器，以初始化时宽度为准，当高度或宽度超过父容器时，父容器出现滚动条 -->',
        '<div class="cute-grid-main " style="height:{{runtime.container.height?runtime.container.height:""}}px;min-height:{{runtime.container.minHeight?runtime.container.minHeight:""}}px;{{runtime.hSb.show?"padding-bottom:" + runtime.container.paddingBottom + "px;":""}};{{runtime.vSb.show?"padding-right:" + runtime.container.paddingRight + "px;":""}}">',

            '<!-- 表头行－thead（固定在顶部） -->',
            '<div class="cute-grid-thead" >',
                '<div class="cute-grid-t-inner" style="width:{{runtime.content.width}}px">',
                    '<div class="cute-grid-row ">',
                        '<div class="cute-grid-cell cute-grid-cell-fixed cute-grid-checkbox" style="width:40px;left:0;z-index:601;">',
                            '<div class="cute-grid-cell-inner ">',
                                '<input type="checkbox" class="cute-grid-ck-selectall"/>',
                            '</div>',
                        '</div>',
                        // 表头列
                        '{{ each cols as col cIndex }}',

                            '<div cindex="{{col.index}}" class="cute-grid-cell {{ col.isFixed ? "cute-grid-cell-fixed" : "" }}" style="width:{{col.width || col._width }}px;left:{{col.pLeft}}px;z-index:{{ 600 - cIndex}};text-align:{{col.align}}">',
                                '<div class="cute-grid-cell-inner cp">',
                                  '<div class="cute-grid-pa">{{col.display}}</div>',
                                  '<div class="cute-grid-sorttype {{ orderBy == col.index ? (sort == "ASC" ? "cute-grid-sorttype-up" : "cute-grid-sorttype-down") : ""}}"></div>',
                                '</div>',
                            '</div>',

                        '{{ /each }}',

                    '</div>',
                '</div>',
            '</div>',

            '<!-- 表格主体－tbody -->',
            '<div class="cute-grid-tbody" >',

                '{{ if (!rows || rows.length == 0) }}',
                    '<div class="cute-grid-t-inner" style="width:{{runtime.content.width}}px;text-align:left;height:40px;line-height:40px;padding-left:10px;">',
                        '{{#runtime.errorText}}',
                    '</div>',
                '{{ else }}',

                    '<div class="cute-grid-t-inner" style="width:{{runtime.content.width}}px">',

                        // 表格行
                        '{{ each rows as row rIndex }}',

                            '<!--  表格行 -->',
                            '<div class="cute-grid-row" rindex="{{rIndex}}">',
                                '<div class="cute-grid-cell cute-grid-cell-fixed cute-grid-checkbox" style="width:40px;left:0;z-index:601;">',
                                    '<input type="checkbox" class="cute-grid-ck" rindex="{{rIndex}}"/>',
                                '</div>',

                                // 表格列，没有设置列宽时，默认150px
                                '{{ each cols as col cIndex }}',
                                    '<div rindex="{{rIndex}}" cindex="{{col.index}}" class="cute-grid-cell {{ col.isFixed ? "cute-grid-cell-fixed" : "" }}" style="width:{{col.width || col._width}}px;left:{{col.pLeft}}px;z-index:{{ 600 - cIndex}};text-align:{{col.align}}">',
                                        '<div class="cute-grid-cell-inner cp">',
                                          '<div class="cute-grid-pa">{{print row[col.index]}}</div>',
                                        '</div>',
                                    '</div>',

                                '{{ /each }}',
                                
                            '</div>',

                        '{{ /each }}',

                    '</div>',

                '{{ /if }}',
            '</div>',

            '<!-- 纵向滚动条 -->',
            '<div class="cute-grid-v-scrollbar-con" style="width:{{runtime.vSb.conBox.width}}px;height:{{runtime.vSb.conBox.height}}px;left:{{runtime.vSb.conBox.left}}px;top:{{runtime.vSb.conBox.top}}px;">',
                '<div class="cute-grid-v-scrollbar-bar" style="width:{{runtime.vSb.box.width}}px;height:{{runtime.vSb.box.height}}px;left:{{runtime.vSb.box.left}}px;top:{{runtime.vSb.box.top}}px;"></div>',
            '</div>',

            '<!-- 横向滚动条 -->',
            '<div class="cute-grid-h-scrollbar-con" style="width:{{runtime.hSb.conBox.width}}px;height:{{runtime.hSb.conBox.height}}px;left:{{runtime.hSb.conBox.left}}px;top:{{runtime.hSb.conBox.top}}px;">',
                '<div class="cute-grid-h-scrollbar-bar" style="width:{{runtime.hSb.box.width}}px;height:{{runtime.hSb.box.height}}px;left:{{runtime.hSb.box.left}}px;top:{{runtime.hSb.box.top}}px;"></div>',
            '</div>',

            '<!-- 右下角的遮罩小方块 -->',
            '<div style="position:absolute;z-index:10000;background-color:#efefef;width:{{runtime.hSb.conBox.height}}px;height:{{runtime.hSb.conBox.height}}px;left:{{runtime.hSb.conBox.width}}px;top:{{runtime.vSb.conBox.height}}px;">',
            '</div>',

        '</div>',

        


        '<!-- 分页条 -->',
        '<div class="cute-grid-pagerbar">',

            '<div class="cute-grid-pagerbar-total">',
                 '共 <span>{{pager.pageTotal}}</span> 页，<span>{{pager.rowsTotal}}</span> 条',
            '</div>',
            '<div class="cute-grid-pagerbar-select-pagesize">',
                '<select class="cute-grid-pagesize-select" style="height:30px;">',

                    // 分页行数
                    '{{ each pager.pageSizeList as pageSize pIndex }}',
                        '<option value="{{pageSize}}" {{pageSize == pager.pageSize ? "selected" : ""}}>{{pageSize}}</option>',
                    '{{ /each }}',

                '</select>',
            '</div>',
            '<div class="cute-grid-pagerbar-next">Next</div>',
            '<div class="cute-grid-pagerbar-pages ">',

                // 分页条
                '{{ each pager.pageNumList as pageNum pIndex }}',
                    '<a href="javascript:void(0);" class="{{ pageNum == pager.pageNo ? "page-selected" : ""}}">{{pageNum}}</a>',
                '{{ /each }}',

            '</div>',
            '<div class="cute-grid-pagerbar-prev">Priv</div>',
        '</div>'
    ].join('');

    // 表格loading时的渲染模版
    CuteGrid.fn.loadingTmpl = [
        '<!-- 表格头和表格主体的包裹容器，以初始化时宽度为准，当高度或宽度超过父容器时，父容器出现滚动条 -->',
        '<div class="cute-grid-main " style="height:{{runtime.container.height?runtime.container.height:""}}px;min-height:{{runtime.container.minHeight?runtime.container.minHeight:""}}px;{{runtime.hSb.show?"padding-bottom:" + runtime.container.paddingBottom + "px;":""}}">',
            '<!-- 表格主体的遮罩层 -->',
            '<div class="cute-grid-main-mask" style="width:{{runtime.container.innerWidth}}px;height:{{runtime.container.height}}px;min-height:{{runtime.container.minHeight?runtime.container.minHeight:""}}px;">&nbsp;</div>',
        '</div>'
    ].join('');


    CuteGrid.fn.init.prototype = CuteGrid.fn;
    $.fn.cuteGrid = CuteGrid;

})(jQuery,template,window,undefined);



// $.resizeEnd 插件，解决 ie & chrome下  $.resize 多次执行的bug
(function(e,d,a){var b,f,c;c="resizeEnd";f={delay:250};b=function(h,g,i){if(typeof g==="function"){i=g;g={}}i=i||null;this.element=h;this.settings=e.extend({},f,g);this._defaults=f;this._name=c;this._timeout=false;this._callback=i;return this.init()};b.prototype={init:function(){var g,h;h=this;g=e(this.element);return g.on("resize",function(){return h.initResize()})},getUTCDate:function(h){var g;h=h||new Date();g=Date.UTC(h.getUTCFullYear(),h.getUTCMonth(),h.getUTCDate(),h.getUTCHours(),h.getUTCMinutes(),h.getUTCSeconds(),h.getUTCMilliseconds());return g},initResize:function(){var g;g=this;g.controlTime=g.getUTCDate();if(g._timeout===false){g._timeout=true;return setTimeout(function(){return g.runCallback(g)},g.settings.delay)}},runCallback:function(h){var g;g=h.getUTCDate();if(g-h.controlTime<h.settings.delay){return setTimeout(function(){return h.runCallback(h)},h.settings.delay)}else{h._timeout=false;return h._callback()}}};return e.fn[c]=function(g,h){return this.each(function(){if(!e.data(this,"plugin_"+c)){return e.data(this,"plugin_"+c,new b(this,g,h))}})}})(jQuery,window,document);




